import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createShare,
    getIncomingShares,
    getOutgoingShares,
    getShareById,
    acceptShare,
    rejectShare,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadNotificationCount,
} from '@/services/shares';
import { login, logout } from '@/services/auth';
import { createPromptSet } from '@/services/promptSets';
import { STORAGE_KEYS } from '@/services/storage';
import { User } from '@/types';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', {
    value: {
        localStorage: localStorageMock,
        crypto: { randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    },
    writable: true
});

// Test data
const sender: User = {
    id: 'sender-1',
    email: 'sender@example.com',
    displayName: 'Sender User',
    role: 'member',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

const recipient: User = {
    id: 'recipient-1',
    email: 'recipient@example.com',
    displayName: 'Recipient User',
    role: 'member',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

const thirdUser: User = {
    id: 'third-1',
    email: 'third@example.com',
    displayName: 'Third User',
    role: 'member',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

describe('Shares Service', () => {
    beforeEach(() => {
        localStorageMock.clear();
        // Set up users in storage
        localStorageMock.setItem(STORAGE_KEYS.USERS, JSON.stringify([sender, recipient, thirdUser]));
    });

    describe('createShare', () => {
        it('should create a share offer', async () => {
            await login(sender.email);
            const promptSet = await createPromptSet({ title: 'Shared Set' });

            const share = await createShare(promptSet!.id, recipient.id);

            expect(share).not.toBeNull();
            expect(share?.senderId).toBe(sender.id);
            expect(share?.recipientId).toBe(recipient.id);
            expect(share?.state).toBe('inTransit');
            expect(share?.promptSetSnapshot.title).toBe('Shared Set');
        });

        it('should create notification for recipient', async () => {
            await login(sender.email);
            const promptSet = await createPromptSet({ title: 'Shared Set' });
            await createShare(promptSet!.id, recipient.id);

            await logout();
            await login(recipient.email);

            const notifications = await getNotifications();

            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe('share_received');
            expect(notifications[0].message).toContain('Shared Set');
        });

        it('should not allow sharing to yourself', async () => {
            await login(sender.email);
            const promptSet = await createPromptSet({ title: 'Test Set' });

            const share = await createShare(promptSet!.id, sender.id);

            expect(share).toBeNull();
        });

        it('should not allow sharing others prompt sets', async () => {
            await login(sender.email);
            const promptSet = await createPromptSet({ title: 'Sender Set' });
            await logout();

            await login(thirdUser.email);
            const share = await createShare(promptSet!.id, recipient.id);

            expect(share).toBeNull();
        });

        it('should not allow sharing to non-existent user', async () => {
            await login(sender.email);
            const promptSet = await createPromptSet({ title: 'Test Set' });

            const share = await createShare(promptSet!.id, 'fake-user-id');

            expect(share).toBeNull();
        });
    });

    describe('getIncomingShares', () => {
        beforeEach(async () => {
            await login(sender.email);
            const set1 = await createPromptSet({ title: 'Set 1' });
            const set2 = await createPromptSet({ title: 'Set 2' });
            await createShare(set1!.id, recipient.id);
            await createShare(set2!.id, recipient.id);
            await logout();
        });

        it('should return incoming shares for recipient', async () => {
            await login(recipient.email);

            const shares = await getIncomingShares();

            expect(shares).toHaveLength(2);
            expect(shares.every(s => s.recipientId === recipient.id)).toBe(true);
        });

        it('should filter by state', async () => {
            await login(recipient.email);
            const shares = await getIncomingShares();
            await acceptShare(shares[0].id);

            const pending = await getIncomingShares('inTransit');
            const accepted = await getIncomingShares('accepted');

            expect(pending).toHaveLength(1);
            expect(accepted).toHaveLength(1);
        });

        it('should return empty for user with no shares', async () => {
            await login(thirdUser.email);

            const shares = await getIncomingShares();

            expect(shares).toHaveLength(0);
        });
    });

    describe('getOutgoingShares', () => {
        it('should return outgoing shares for sender', async () => {
            await login(sender.email);
            const set = await createPromptSet({ title: 'My Set' });
            await createShare(set!.id, recipient.id);
            await createShare(set!.id, thirdUser.id);

            const shares = await getOutgoingShares();

            expect(shares).toHaveLength(2);
            expect(shares.every(s => s.senderId === sender.id)).toBe(true);
        });
    });

    describe('acceptShare', () => {
        let shareId: string;

        beforeEach(async () => {
            await login(sender.email);
            const set = await createPromptSet({
                title: 'To Share',
                initialPrompt: 'Original prompt'
            });
            const share = await createShare(set!.id, recipient.id);
            shareId = share!.id;
            await logout();
        });

        it('should create a copy of prompt set for recipient', async () => {
            await login(recipient.email);

            const newSet = await acceptShare(shareId);

            expect(newSet).not.toBeNull();
            expect(newSet?.userId).toBe(recipient.id);
            expect(newSet?.title).toBe('To Share');
            expect(newSet?.versions).toHaveLength(1);
        });

        it('should update share state to accepted', async () => {
            await login(recipient.email);
            await acceptShare(shareId);

            const share = await getShareById(shareId);

            expect(share?.state).toBe('accepted');
            expect(share?.respondedAt).toBeDefined();
        });

        it('should notify sender of acceptance', async () => {
            await login(recipient.email);
            await acceptShare(shareId);
            await logout();

            await login(sender.email);
            const notifications = await getNotifications();

            expect(notifications.some(n => n.type === 'share_accepted')).toBe(true);
        });

        it('should not allow accepting twice', async () => {
            await login(recipient.email);
            await acceptShare(shareId);

            const secondAttempt = await acceptShare(shareId);

            expect(secondAttempt).toBeNull();
        });

        it('should not allow non-recipient to accept', async () => {
            await login(thirdUser.email);

            const result = await acceptShare(shareId);

            expect(result).toBeNull();
        });
    });

    describe('rejectShare', () => {
        let shareId: string;

        beforeEach(async () => {
            await login(sender.email);
            const set = await createPromptSet({ title: 'To Reject' });
            const share = await createShare(set!.id, recipient.id);
            shareId = share!.id;
            await logout();
        });

        it('should update share state to rejected', async () => {
            await login(recipient.email);

            const result = await rejectShare(shareId);
            const share = await getShareById(shareId);

            expect(result).toBe(true);
            expect(share?.state).toBe('rejected');
        });

        it('should notify sender of rejection', async () => {
            await login(recipient.email);
            await rejectShare(shareId);
            await logout();

            await login(sender.email);
            const notifications = await getNotifications();

            expect(notifications.some(n => n.type === 'share_rejected')).toBe(true);
        });

        it('should not allow rejecting twice', async () => {
            await login(recipient.email);
            await rejectShare(shareId);

            const secondAttempt = await rejectShare(shareId);

            expect(secondAttempt).toBe(false);
        });
    });

    describe('Notifications', () => {
        beforeEach(async () => {
            // Create some shares which generate notifications
            await login(sender.email);
            const set1 = await createPromptSet({ title: 'Set 1' });
            const set2 = await createPromptSet({ title: 'Set 2' });
            await createShare(set1!.id, recipient.id);
            await createShare(set2!.id, recipient.id);
            await logout();
        });

        describe('getNotifications', () => {
            it('should return all notifications for user', async () => {
                await login(recipient.email);

                const notifications = await getNotifications();

                expect(notifications).toHaveLength(2);
            });

            it('should filter unread only', async () => {
                await login(recipient.email);
                const notifications = await getNotifications();
                await markNotificationRead(notifications[0].id);

                const unread = await getNotifications(true);

                expect(unread).toHaveLength(1);
            });

            it('should be sorted by createdAt descending', async () => {
                await login(recipient.email);

                const notifications = await getNotifications();

                const dates = notifications.map(n => new Date(n.createdAt).getTime());
                expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
            });
        });

        describe('markNotificationRead', () => {
            it('should mark notification as read', async () => {
                await login(recipient.email);
                const notifications = await getNotifications();

                const result = await markNotificationRead(notifications[0].id);

                expect(result).toBe(true);
                const updated = await getNotifications();
                expect(updated.find(n => n.id === notifications[0].id)?.read).toBe(true);
            });

            it('should return false for non-existent notification', async () => {
                await login(recipient.email);

                const result = await markNotificationRead('fake-id');

                expect(result).toBe(false);
            });
        });

        describe('markAllNotificationsRead', () => {
            it('should mark all notifications as read', async () => {
                await login(recipient.email);

                await markAllNotificationsRead();

                const unread = await getNotifications(true);
                expect(unread).toHaveLength(0);
            });
        });

        describe('getUnreadNotificationCount', () => {
            it('should return correct count', async () => {
                await login(recipient.email);

                expect(await getUnreadNotificationCount()).toBe(2);

                const notifications = await getNotifications();
                await markNotificationRead(notifications[0].id);

                expect(await getUnreadNotificationCount()).toBe(1);
            });
        });
    });
});
