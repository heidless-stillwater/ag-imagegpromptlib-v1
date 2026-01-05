'use client';

import { useState } from 'react';
import { User } from '@/types';
import { searchUsers, getPublicDirectory, resolveInviteLink, createInviteLink, getInviteUrl } from '@/services/users';
import { createShare } from '@/services/shares';
import { getPromptSetById } from '@/services/promptSets';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import styles from './ShareModal.module.css';

interface ShareModalProps {
    promptSetId: string;
    onClose: () => void;
}

type TabType = 'search' | 'directory' | 'invite';

export default function ShareModal({ promptSetId, onClose }: ShareModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteUser, setInviteUser] = useState<User | null>(null);
    const [myInviteLink, setMyInviteLink] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    const promptSet = getPromptSetById(promptSetId);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            setSearchResults(searchUsers(searchQuery));
        }
    };

    const loadDirectory = () => {
        setDirectoryUsers(getPublicDirectory());
    };

    const handleResolveInvite = () => {
        const user = resolveInviteLink(inviteCode);
        setInviteUser(user);
    };

    const handleCreateInviteLink = () => {
        const link = createInviteLink(7); // 7 days expiry
        if (link) {
            setMyInviteLink(getInviteUrl(link.code));
        }
    };

    const handleShare = async (recipientId: string) => {
        setIsSharing(true);
        const share = createShare(promptSetId, recipientId);
        setIsSharing(false);

        if (share) {
            setShareSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        }
    };

    if (shareSuccess) {
        return (
            <Modal isOpen={true} onClose={onClose} title="Share Sent!">
                <div className={styles.success}>
                    <span className={styles.successIcon}>✓</span>
                    <p>Your prompt set has been shared successfully!</p>
                    <p className={styles.successSubtext}>The recipient will see it in their share queue.</p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={true} onClose={onClose} title={`Share "${promptSet?.title}"`} size="lg">
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
                    onClick={() => setActiveTab('search')}
                >
                    🔍 Search
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'directory' ? styles.active : ''}`}
                    onClick={() => { setActiveTab('directory'); loadDirectory(); }}
                >
                    📋 Directory
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'invite' ? styles.active : ''}`}
                    onClick={() => setActiveTab('invite')}
                >
                    🔗 Invite Link
                </button>
            </div>

            <div className={styles.content}>
                {activeTab === 'search' && (
                    <div className={styles.searchTab}>
                        <div className={styles.searchBox}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Search by email or name..."
                                className="input"
                            />
                            <Button onClick={handleSearch}>Search</Button>
                        </div>

                        <div className={styles.userList}>
                            {searchResults.length === 0 ? (
                                <p className={styles.noResults}>Search for users to share with</p>
                            ) : (
                                searchResults.map(user => (
                                    <div key={user.id} className={styles.userItem}>
                                        <div className={styles.avatar}>
                                            {user.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={styles.userInfo}>
                                            <span className={styles.userName}>{user.displayName}</span>
                                            <span className={styles.userEmail}>{user.email}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleShare(user.id)}
                                            isLoading={isSharing}
                                        >
                                            Share
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'directory' && (
                    <div className={styles.directoryTab}>
                        <p className={styles.tabDescription}>
                            Browse public users who are open to receiving shares
                        </p>
                        <div className={styles.userList}>
                            {directoryUsers.length === 0 ? (
                                <p className={styles.noResults}>No public users found</p>
                            ) : (
                                directoryUsers.map(user => (
                                    <div key={user.id} className={styles.userItem}>
                                        <div className={styles.avatar}>
                                            {user.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={styles.userInfo}>
                                            <span className={styles.userName}>{user.displayName}</span>
                                            <span className={styles.userEmail}>{user.email}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleShare(user.id)}
                                            isLoading={isSharing}
                                        >
                                            Share
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'invite' && (
                    <div className={styles.inviteTab}>
                        <div className={styles.inviteSection}>
                            <h4>Share via Invite Code</h4>
                            <p className={styles.tabDescription}>
                                Enter an invite code from another user
                            </p>
                            <div className={styles.inviteInput}>
                                <input
                                    type="text"
                                    value={inviteCode}
                                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                                    placeholder="Enter invite code (e.g., ABC12345)"
                                    className="input"
                                    maxLength={8}
                                />
                                <Button onClick={handleResolveInvite}>Find User</Button>
                            </div>

                            {inviteUser && (
                                <div className={styles.userItem}>
                                    <div className={styles.avatar}>
                                        {inviteUser.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.userInfo}>
                                        <span className={styles.userName}>{inviteUser.displayName}</span>
                                        <span className={styles.userEmail}>{inviteUser.email}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleShare(inviteUser.id)}
                                        isLoading={isSharing}
                                    >
                                        Share
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className={styles.divider} />

                        <div className={styles.inviteSection}>
                            <h4>Create Your Invite Link</h4>
                            <p className={styles.tabDescription}>
                                Generate a link others can use to share with you
                            </p>

                            {myInviteLink ? (
                                <div className={styles.inviteLinkBox}>
                                    <input
                                        type="text"
                                        value={myInviteLink}
                                        readOnly
                                        className="input"
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={() => navigator.clipboard.writeText(myInviteLink)}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            ) : (
                                <Button variant="secondary" onClick={handleCreateInviteLink}>
                                    Generate Invite Link
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
