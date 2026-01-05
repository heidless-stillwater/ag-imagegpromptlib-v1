'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Share } from '@/types';
import { getIncomingShares, getOutgoingShares, acceptShare, rejectShare } from '@/services/shares';
import { getUserById } from '@/services/auth';
import { useNotifications } from '@/hooks/useNotifications';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

type TabType = 'incoming' | 'outgoing';

export default function SharesPage() {
    const { user } = useAuth();
    const { refresh: refreshNotifications } = useNotifications();
    const [activeTab, setActiveTab] = useState<TabType>('incoming');
    const [incomingShares, setIncomingShares] = useState<Share[]>([]);
    const [outgoingShares, setOutgoingShares] = useState<Share[]>([]);

    useEffect(() => {
        loadShares();
    }, [user]);

    const loadShares = () => {
        setIncomingShares(getIncomingShares());
        setOutgoingShares(getOutgoingShares());
    };

    const handleAccept = (shareId: string) => {
        acceptShare(shareId);
        loadShares();
        refreshNotifications();
    };

    const handleReject = (shareId: string) => {
        if (confirm('Are you sure you want to reject this share?')) {
            rejectShare(shareId);
            loadShares();
            refreshNotifications();
        }
    };

    const getStatusBadge = (state: Share['state']) => {
        const badges = {
            inTransit: { label: 'Pending', class: styles.pending },
            accepted: { label: 'Accepted', class: styles.accepted },
            rejected: { label: 'Rejected', class: styles.rejected },
        };
        const badge = badges[state];
        return <span className={`${styles.badge} ${badge.class}`}>{badge.label}</span>;
    };

    const renderShareItem = (share: Share, type: 'incoming' | 'outgoing') => {
        const otherUser = getUserById(type === 'incoming' ? share.senderId : share.recipientId);

        return (
            <div key={share.id} className={styles.shareItem}>
                <div className={styles.sharePreview}>
                    {share.promptSetSnapshot.versions.find(v => v.imageUrl)?.imageUrl ? (
                        <img
                            src={share.promptSetSnapshot.versions.find(v => v.imageUrl)?.imageUrl}
                            alt={share.promptSetSnapshot.title}
                            className={styles.previewImage}
                        />
                    ) : (
                        <div className={styles.noImage}>🖼️</div>
                    )}
                </div>

                <div className={styles.shareInfo}>
                    <h3 className={styles.shareTitle}>{share.promptSetSnapshot.title}</h3>
                    <p className={styles.shareDescription}>
                        {share.promptSetSnapshot.description || 'No description'}
                    </p>
                    <div className={styles.shareMeta}>
                        <span className={styles.user}>
                            {type === 'incoming' ? 'From: ' : 'To: '}
                            <strong>{otherUser?.displayName || 'Unknown'}</strong>
                        </span>
                        <span className={styles.date}>
                            {new Date(share.createdAt).toLocaleDateString()}
                        </span>
                        <span className={styles.versions}>
                            {share.promptSetSnapshot.versions.length} versions
                        </span>
                    </div>
                </div>

                <div className={styles.shareActions}>
                    {getStatusBadge(share.state)}

                    {type === 'incoming' && share.state === 'inTransit' && (
                        <div className={styles.actionButtons}>
                            <Button size="sm" variant="success" onClick={() => handleAccept(share.id)}>
                                Accept
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleReject(share.id)}>
                                Reject
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const pendingIncoming = incomingShares.filter(s => s.state === 'inTransit').length;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Share Queue</h1>
                <p className={styles.subtitle}>
                    Manage incoming and outgoing prompt set shares
                </p>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'incoming' ? styles.active : ''}`}
                    onClick={() => setActiveTab('incoming')}
                >
                    📥 Incoming
                    {pendingIncoming > 0 && <span className={styles.tabBadge}>{pendingIncoming}</span>}
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'outgoing' ? styles.active : ''}`}
                    onClick={() => setActiveTab('outgoing')}
                >
                    📤 Outgoing
                </button>
            </div>

            <div className={styles.content}>
                {activeTab === 'incoming' && (
                    <div className={styles.shareList}>
                        {incomingShares.length === 0 ? (
                            <div className={styles.empty}>
                                <span className={styles.emptyIcon}>📥</span>
                                <h3>No incoming shares</h3>
                                <p>When someone shares a prompt set with you, it will appear here</p>
                            </div>
                        ) : (
                            incomingShares.map(share => renderShareItem(share, 'incoming'))
                        )}
                    </div>
                )}

                {activeTab === 'outgoing' && (
                    <div className={styles.shareList}>
                        {outgoingShares.length === 0 ? (
                            <div className={styles.empty}>
                                <span className={styles.emptyIcon}>📤</span>
                                <h3>No outgoing shares</h3>
                                <p>Share a prompt set from your dashboard to see it here</p>
                            </div>
                        ) : (
                            outgoingShares.map(share => renderShareItem(share, 'outgoing'))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
