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
export async function createShare(promptSetId: string, recipientId: string): Promise<Share | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // Cannot share to yourself
    if (currentUser.id === recipientId) return null;

    // Get the prompt set
    const promptSet = await getPromptSetById(promptSetId);
    if (!promptSet) return null;

    // Check if user owns this prompt set
    if (promptSet.userId !== currentUser.id) return null;

    // Check if recipient exists
    const recipient = await getUserById(recipientId);
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

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
    await setCollection(STORAGE_KEYS.SHARES, [...shares, share]);

    // Create notification for recipient
    await createNotification(recipientId, 'share_received',
        `${currentUser.displayName} shared "${promptSet.title}" with you`,
        share.id
    );

    return share;
}

/**
 * Get incoming shares for current user
 */
export async function getIncomingShares(state?: Share['state']): Promise<Share[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
    let filtered = shares.filter(s => s.recipientId === currentUser.id);

    if (state) {
        filtered = filtered.filter(s => s.state === state);
    }

    return filtered;
}

/**
 * Get outgoing shares for current user
 */
export async function getOutgoingShares(state?: Share['state']): Promise<Share[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
    let filtered = shares.filter(s => s.senderId === currentUser.id);

    if (state) {
        filtered = filtered.filter(s => s.state === state);
    }

    return filtered;
}

/**
 * Get a specific share by ID
 */
export async function getShareById(id: string): Promise<Share | null> {
    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
    return shares.find(s => s.id === id) || null;
}

/**
 * Accept a share
 */
export async function acceptShare(shareId: string): Promise<PromptSet | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
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
    const promptSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    await setCollection(STORAGE_KEYS.PROMPT_SETS, [...promptSets, newPromptSet]);

    // Update share state
    shares[shareIndex] = {
        ...share,
        state: 'accepted',
        respondedAt: now,
    };
    await setCollection(STORAGE_KEYS.SHARES, shares);

    // Notify sender
    const sender = await getUserById(share.senderId);
    await createNotification(share.senderId, 'share_accepted',
        `${currentUser.displayName} accepted your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return newPromptSet;
}

/**
 * Reject a share
 */
export async function rejectShare(shareId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
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
    await setCollection(STORAGE_KEYS.SHARES, shares);

    // Notify sender
    await createNotification(share.senderId, 'share_rejected',
        `${currentUser.displayName} declined your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return true;
}

/**
 * Remove a share from the queue
 */
export async function removeShare(shareId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const shares = await getCollection<Share>(STORAGE_KEYS.SHARES);
    const shareIndex = shares.findIndex(s => s.id === shareId);

    if (shareIndex === -1) return false;

    const share = shares[shareIndex];

    // Authorization: User must be sender or recipient
    if (share.senderId !== currentUser.id && share.recipientId !== currentUser.id) {
        return false;
    }

    const filtered = shares.filter(s => s.id !== shareId);
    await setCollection(STORAGE_KEYS.SHARES, filtered);
    return true;
}

/**
 * Create a notification
 */
async function createNotification(
    userId: string,
    type: Notification['type'],
    message: string,
    relatedShareId?: string
): Promise<Notification> {
    const notification: Notification = {
        id: generateId(),
        userId,
        type,
        message,
        relatedShareId,
        read: false,
        createdAt: getTimestamp(),
    };

    const notifications = await getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    await setCollection(STORAGE_KEYS.NOTIFICATIONS, [...notifications, notification]);

    return notification;
}

/**
 * Get notifications for current user
 */
export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const notifications = await getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
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
export async function markNotificationRead(id: string): Promise<boolean> {
    const notifications = await getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const notifIndex = notifications.findIndex(n => n.id === id);

    if (notifIndex === -1) return false;

    notifications[notifIndex] = {
        ...notifications[notifIndex],
        read: true,
    };

    await setCollection(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return true;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<void> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;

    const notifications = await getCollection<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    const updated = notifications.map(n =>
        n.userId === currentUser.id ? { ...n, read: true } : n
    );

    await setCollection(STORAGE_KEYS.NOTIFICATIONS, updated);
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const notifs = await getNotifications(true);
    return notifs.length;
}
