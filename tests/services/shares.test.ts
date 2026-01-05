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
        it('should create a share offer', () => {
            login(sender.email);
            const promptSet = createPromptSet({ title: 'Shared Set' });

            const share = createShare(promptSet!.id, recipient.id);

            expect(share).not.toBeNull();
            expect(share?.senderId).toBe(sender.id);
            expect(share?.recipientId).toBe(recipient.id);
            expect(share?.state).toBe('inTransit');
            expect(share?.promptSetSnapshot.title).toBe('Shared Set');
        });

        it('should create notification for recipient', () => {
            login(sender.email);
            const promptSet = createPromptSet({ title: 'Shared Set' });
            createShare(promptSet!.id, recipient.id);

            logout();
            login(recipient.email);

            const notifications = getNotifications();

            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe('share_received');
            expect(notifications[0].message).toContain('Shared Set');
        });

        it('should not allow sharing to yourself', () => {
            login(sender.email);
            const promptSet = createPromptSet({ title: 'Test Set' });

            const share = createShare(promptSet!.id, sender.id);

            expect(share).toBeNull();
        });

        it('should not allow sharing others prompt sets', () => {
            login(sender.email);
            const promptSet = createPromptSet({ title: 'Sender Set' });
            logout();

            login(thirdUser.email);
            const share = createShare(promptSet!.id, recipient.id);

            expect(share).toBeNull();
        });

        it('should not allow sharing to non-existent user', () => {
            login(sender.email);
            const promptSet = createPromptSet({ title: 'Test Set' });

            const share = createShare(promptSet!.id, 'fake-user-id');

            expect(share).toBeNull();
        });
    });

    describe('getIncomingShares', () => {
        beforeEach(() => {
            login(sender.email);
            const set1 = createPromptSet({ title: 'Set 1' });
            const set2 = createPromptSet({ title: 'Set 2' });
            createShare(set1!.id, recipient.id);
            createShare(set2!.id, recipient.id);
            logout();
        });

        it('should return incoming shares for recipient', () => {
            login(recipient.email);

            const shares = getIncomingShares();

            expect(shares).toHaveLength(2);
            expect(shares.every(s => s.recipientId === recipient.id)).toBe(true);
        });

        it('should filter by state', () => {
            login(recipient.email);
            const shares = getIncomingShares();
            acceptShare(shares[0].id);

            const pending = getIncomingShares('inTransit');
            const accepted = getIncomingShares('accepted');

            expect(pending).toHaveLength(1);
            expect(accepted).toHaveLength(1);
        });

        it('should return empty for user with no shares', () => {
            login(thirdUser.email);

            const shares = getIncomingShares();

            expect(shares).toHaveLength(0);
        });
    });

    describe('getOutgoingShares', () => {
        it('should return outgoing shares for sender', () => {
            login(sender.email);
            const set = createPromptSet({ title: 'My Set' });
            createShare(set!.id, recipient.id);
            createShare(set!.id, thirdUser.id);

            const shares = getOutgoingShares();

            expect(shares).toHaveLength(2);
            expect(shares.every(s => s.senderId === sender.id)).toBe(true);
        });
    });

    describe('acceptShare', () => {
        let shareId: string;

        beforeEach(() => {
            login(sender.email);
            const set = createPromptSet({
                title: 'To Share',
                initialPrompt: 'Original prompt'
            });
            const share = createShare(set!.id, recipient.id);
            shareId = share!.id;
            logout();
        });

        it('should create a copy of prompt set for recipient', () => {
            login(recipient.email);

            const newSet = acceptShare(shareId);

            expect(newSet).not.toBeNull();
            expect(newSet?.userId).toBe(recipient.id);
            expect(newSet?.title).toBe('To Share');
            expect(newSet?.versions).toHaveLength(1);
        });

        it('should update share state to accepted', () => {
            login(recipient.email);
            acceptShare(shareId);

            const share = getShareById(shareId);

            expect(share?.state).toBe('accepted');
            expect(share?.respondedAt).toBeDefined();
        });

        it('should notify sender of acceptance', () => {
            login(recipient.email);
            acceptShare(shareId);
            logout();

            login(sender.email);
            const notifications = getNotifications();

            expect(notifications.some(n => n.type === 'share_accepted')).toBe(true);
        });

        it('should not allow accepting twice', () => {
            login(recipient.email);
            acceptShare(shareId);

            const secondAttempt = acceptShare(shareId);

            expect(secondAttempt).toBeNull();
        });

        it('should not allow non-recipient to accept', () => {
            login(thirdUser.email);

            const result = acceptShare(shareId);

            expect(result).toBeNull();
        });
    });

    describe('rejectShare', () => {
        let shareId: string;

        beforeEach(() => {
            login(sender.email);
            const set = createPromptSet({ title: 'To Reject' });
            const share = createShare(set!.id, recipient.id);
            shareId = share!.id;
            logout();
        });

        it('should update share state to rejected', () => {
            login(recipient.email);

            const result = rejectShare(shareId);
            const share = getShareById(shareId);

            expect(result).toBe(true);
            expect(share?.state).toBe('rejected');
        });

        it('should notify sender of rejection', () => {
            login(recipient.email);
            rejectShare(shareId);
            logout();

            login(sender.email);
            const notifications = getNotifications();

            expect(notifications.some(n => n.type === 'share_rejected')).toBe(true);
        });

        it('should not allow rejecting twice', () => {
            login(recipient.email);
            rejectShare(shareId);

            const secondAttempt = rejectShare(shareId);

            expect(secondAttempt).toBe(false);
        });
    });

    describe('Notifications', () => {
        beforeEach(() => {
            // Create some shares which generate notifications
            login(sender.email);
            const set1 = createPromptSet({ title: 'Set 1' });
            const set2 = createPromptSet({ title: 'Set 2' });
            createShare(set1!.id, recipient.id);
            createShare(set2!.id, recipient.id);
            logout();
        });

        describe('getNotifications', () => {
            it('should return all notifications for user', () => {
                login(recipient.email);

                const notifications = getNotifications();

                expect(notifications).toHaveLength(2);
            });

            it('should filter unread only', () => {
                login(recipient.email);
                const notifications = getNotifications();
                markNotificationRead(notifications[0].id);

                const unread = getNotifications(true);

                expect(unread).toHaveLength(1);
            });

            it('should be sorted by createdAt descending', () => {
                login(recipient.email);

                const notifications = getNotifications();

                const dates = notifications.map(n => new Date(n.createdAt).getTime());
                expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
            });
        });

        describe('markNotificationRead', () => {
            it('should mark notification as read', () => {
                login(recipient.email);
                const notifications = getNotifications();

                const result = markNotificationRead(notifications[0].id);

                expect(result).toBe(true);
                const updated = getNotifications();
                expect(updated.find(n => n.id === notifications[0].id)?.read).toBe(true);
            });

            it('should return false for non-existent notification', () => {
                login(recipient.email);

                const result = markNotificationRead('fake-id');

                expect(result).toBe(false);
            });
        });

        describe('markAllNotificationsRead', () => {
            it('should mark all notifications as read', () => {
                login(recipient.email);

                markAllNotificationsRead();

                const unread = getNotifications(true);
                expect(unread).toHaveLength(0);
            });
        });

        describe('getUnreadNotificationCount', () => {
            it('should return correct count', () => {
                login(recipient.email);

                expect(getUnreadNotificationCount()).toBe(2);

                const notifications = getNotifications();
                markNotificationRead(notifications[0].id);

                expect(getUnreadNotificationCount()).toBe(1);
            });
        });
    });
});
