'use client';

import { useState, useEffect } from 'react';
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '@/services/shares';
import { Notification } from '@/types';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const refresh = () => {
        setNotifications(getNotifications());
        setUnreadCount(getUnreadNotificationCount());
    };

    useEffect(() => {
        refresh();
        // Poll for new notifications every 5 seconds
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, []);

    const markAsRead = (id: string) => {
        markNotificationRead(id);
        refresh();
    };

    const markAllAsRead = () => {
        markAllNotificationsRead();
        refresh();
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refresh,
    };
}
