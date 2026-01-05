import { Share, PromptSet, Notification } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser, getUserById } from './auth';
import { getPromptSetById, duplicatePromptSet } from './promptSets';

/**
 * Create a new share offer
 */
export function createShare(promptSetId: string, recipientId: string): Share | null {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    // Cannot share to yourself
    if (currentUser.id === recipientId) return null;

    // Get the prompt set
    const promptSet = getPromptSetById(promptSetId);
    if (!promptSet) return null;

    // Check if user owns this prompt set
    if (promptSet.userId !== currentUser.id) return null;

    // Check if recipient exists
    const recipient = getUserById(recipientId);
    if (!recipient) return null;

    const now = getTimestamp();

    // Create a deep copy snapshot
    const promptSetSnapshot: PromptSet = JSON.parse(JSON.stringify(promptSet));

    const share: Share = {
        id: generateId(),
        promptSetId,
        promptSetSnapshot,
        senderId: currentUser.id,
        recipientId,
        state: 'inTransit',
        createdAt: now,
    };

    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    setCollection(STORAGE_KEYS.SHARES, [...shares, share]);

    // Create notification for recipient
    createNotification(recipientId, 'share_received',
        `${currentUser.displayName} shared "${promptSet.title}" with you`,
        share.id
    );

    return share;
}

/**
 * Get incoming shares for current user
 */
export function getIncomingShares(state?: Share['state']): Share[] {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    let filtered = shares.filter(s => s.recipientId === currentUser.id);

    if (state) {
        filtered = filtered.filter(s => s.state === state);
    }

    return filtered;
}

/**
 * Get outgoing shares for current user
 */
export function getOutgoingShares(state?: Share['state']): Share[] {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    let filtered = shares.filter(s => s.senderId === currentUser.id);

    if (state) {
        filtered = filtered.filter(s => s.state === state);
    }

    return filtered;
}

/**
 * Get a specific share by ID
 */
export function getShareById(id: string): Share | null {
    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    return shares.find(s => s.id === id) || null;
}

/**
 * Accept a share
 */
export function acceptShare(shareId: string): PromptSet | null {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    const shareIndex = shares.findIndex(s => s.id === shareId);

    if (shareIndex === -1) return null;

    const share = shares[shareIndex];

    // Check if current user is the recipient
    if (share.recipientId !== currentUser.id) return null;

    // Check if share is still pending
    if (share.state !== 'inTransit') return null;

    const now = getTimestamp();

    // Create the duplicated prompt set from snapshot
    const newSetId = generateId();
    const newVersions = share.promptSetSnapshot.versions.map(v => ({
        ...v,
        id: generateId(),
        promptSetId: newSetId,
        createdAt: now,
        updatedAt: now,
    }));

    const newPromptSet: PromptSet = {
        ...share.promptSetSnapshot,
        id: newSetId,
        userId: currentUser.id,
        versions: newVersions,
        createdAt: now,
        updatedAt: now,
    };

    // Add to prompt sets
    const promptSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    setCollection(STORAGE_KEYS.PROMPT_SETS, [...promptSets, newPromptSet]);

    // Update share state
    shares[shareIndex] = {
        ...share,
        state: 'accepted',
        respondedAt: now,
    };
    setCollection(STORAGE_KEYS.SHARES, shares);

    // Notify sender
    const sender = getUserById(share.senderId);
    createNotification(share.senderId, 'share_accepted',
        `${currentUser.displayName} accepted your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return newPromptSet;
}

/**
 * Reject a share
 */
export function rejectShare(shareId: string): boolean {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    const shares = getCollection<Share>(STORAGE_KEYS.SHARES);
    const shareIndex = shares.findIndex(s => s.id === shareId);

    if (shareIndex === -1) return false;

    const share = shares[shareIndex];

    // Check if current user is the recipient
    if (share.recipientId !== currentUser.id) return false;

    // Check if share is still pending
    if (share.state !== 'inTransit') return false;

    const now = getTimestamp();

    // Update share state
    shares[shareIndex] = {
        ...share,
        state: 'rejected',
        respondedAt: now,
    };
    setCollection(STORAGE_KEYS.SHARES, shares);

    // Notify sender
    createNotification(share.senderId, 'share_rejected',
        `${currentUser.displayName} declined your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return true;
}

/**
 * Create a notification
 */
function createNotification(
    userId: string,
    type: Notification['type'],
    message: string,
    relatedShareId?: string
): Notification {
    const notification: Notification = {
        id: generateId(),
        userId,
        type,
        message,
        relatedShareId,
        read: false,
        createdAt: getTimestamp(),
    };

    const notifications = getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    setCollection(STORAGE_KEYS.NOTIFICATIONS, [...notifications, notification]);

    return notification;
}

/**
 * Get notifications for current user
 */
export function getNotifications(unreadOnly = false): Notification[] {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const notifications = getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    let filtered = notifications.filter(n => n.userId === currentUser.id);

    if (unreadOnly) {
        filtered = filtered.filter(n => !n.read);
    }

    return filtered.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/**
 * Mark notification as read
 */
export function markNotificationRead(id: string): boolean {
    const notifications = getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const notifIndex = notifications.findIndex(n => n.id === id);

    if (notifIndex === -1) return false;

    notifications[notifIndex] = {
        ...notifications[notifIndex],
        read: true,
    };

    setCollection(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return true;
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsRead(): void {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const notifications = getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const updated = notifications.map(n =>
        n.userId === currentUser.id ? { ...n, read: true } : n
    );

    setCollection(STORAGE_KEYS.NOTIFICATIONS, updated);
}

/**
 * Get unread notification count
 */
export function getUnreadNotificationCount(): number {
    return getNotifications(true).length;
}
