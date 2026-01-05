'use client';

import { useState, useEffect } from 'react';
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '@/services/notifications';
import { Notification } from '@/types';

export function useNotifications() {
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
        refresh();
        // Poll for new notifications every 5 seconds
        const interval = setInterval(() => {
            refresh();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

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
