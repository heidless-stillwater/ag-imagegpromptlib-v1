import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification } from '@/types';
import { getCurrentUser } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'notifications';

/**
 * Create a notification
 */
export async function createNotification(
    userId: string,
    type: Notification['type'],
    message: string,
    relatedShareId?: string
): Promise<Notification> {
    const id = generateId();
    const notification: Notification = {
        id,
        userId,
        type,
        message,
        relatedShareId,
        read: false,
        createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(notification));
    return notification;
}

/**
 * Get notifications for current user
 */
export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, COLLECTION_NAME);
    let q = query(colRef, where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    let notifications = snapshot.docs.map(doc => doc.data() as Notification);

    if (unreadOnly) {
        notifications = notifications.filter(n => !n.read);
    }

    return notifications;
}

/**
 * Mark as read
 */
export async function markNotificationRead(id: string): Promise<boolean> {
    await updateDoc(doc(db, COLLECTION_NAME, id), { read: true });
    return true;
}

/**
 * Mark all as read
 */
export async function markAllNotificationsRead(): Promise<void> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;

    const unread = await getNotifications(true);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    for (const n of unread) {
        batch.update(doc(db, COLLECTION_NAME, n.id), { read: true });
    }
    await batch.commit();
}

/**
 * Count unread
 */
export async function getUnreadNotificationCount(): Promise<number> {
    const unread = await getNotifications(true);
    return unread.length;
}
