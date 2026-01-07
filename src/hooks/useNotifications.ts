'use client';

import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { markNotificationRead, markAllNotificationsRead, getNotifications, getUnreadNotificationCount } from '@/services/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { Notification } from '@/types';

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const refresh = async () => {
        try {
            const [notifs, count] = await Promise.all([
                getNotifications(),
                getUnreadNotificationCount()
            ]);
            setNotifications(notifs);
            setUnreadCount(count);
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const colRef = collection(db, 'notifications');
        const q = query(colRef, where('userId', '==', user.id), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        }, (error) => {
            console.error('Error listening to notifications:', error);
        });

        return () => unsubscribe();
    }, [user]);

    const markAsRead = async (id: string) => {
        await markNotificationRead(id);
        await refresh();
    };

    const markAllAsRead = async () => {
        await markAllNotificationsRead();
        await refresh();
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refresh,
    };
}
