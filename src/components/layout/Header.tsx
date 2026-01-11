'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useShares } from '@/hooks/useShares';
import SettingsModal from '@/components/profile/SettingsModal';
import styles from './Header.module.css';

export default function Header() {
    const { user, isAdmin, logout, switchRole } = useAuth();
    const { unreadCount } = useNotifications();
    const { pendingIncomingCount } = useShares();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (!user) return null;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <Link href="/dashboard" className={styles.logo}>
                        <span className={styles.logoIcon}>🎨</span>
                        <span className={styles.logoText}>PromptVault</span>
                    </Link>

                    <nav className={`${styles.nav} ${isMenuOpen ? styles.mobileOpen : ''}`}>
                        <Link
                            href="/dashboard"
                            className={`${styles.navLink} ${pathname === '/dashboard' ? styles.active : ''}`}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                            </svg>
                            Dashboard
                        </Link>
                        <Link
                            href="/media"
                            className={`${styles.navLink} ${pathname === '/media' ? styles.active : ''}`}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            Media
                        </Link>
                        <Link
                            href="/backups"
                            className={`${styles.navLink} ${pathname === '/backups' ? styles.active : ''}`}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Backup
                        </Link>
                        <Link
                            href="/api-keys"
                            className={`${styles.navLink} ${pathname === '/api-keys' ? styles.active : ''}`}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                            </svg>
                            API Keys
                        </Link>
                        <Link
                            href="/shares"
                            className={`${styles.navLink} ${pathname === '/shares' ? styles.active : ''}`}
                            onClick={() => setIsMenuOpen(false)}
                        >
                            <div className={styles.navLinkContent}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                <span>Shares</span>
                                {pendingIncomingCount > 0 && (
                                    <span className={styles.badge}>{pendingIncomingCount}</span>
                                )}
                            </div>
                        </Link>
                        {isAdmin && (
                            <Link
                                href="/admin"
                                className={`${styles.navLink} ${pathname === '/admin' ? styles.active : ''}`}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                Admin
                            </Link>
                        )}

                        <button
                            className={styles.navLink}
                            onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }}
                            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.navIcon}>
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Settings
                        </button>

                        {/* Mobile-only role toggle */}
                        <div className={styles.mobileRoleToggle}>
                            <p className={styles.mobileLabel}>Switch Role</p>
                            <div className={styles.roleToggle}>
                                <button
                                    className={`${styles.roleBtn} ${!isAdmin ? styles.active : ''}`}
                                    onClick={() => { switchRole('member'); setIsMenuOpen(false); }}
                                >
                                    Member
                                </button>
                                <button
                                    className={`${styles.roleBtn} ${isAdmin ? styles.active : ''}`}
                                    onClick={() => { switchRole('admin'); setIsMenuOpen(false); }}
                                >
                                    Admin
                                </button>
                            </div>
                        </div>

                        <button className={styles.mobileLogoutBtn} onClick={() => { logout(); setIsMenuOpen(false); }}>
                            Logout
                        </button>
                    </nav>
                </div>

                <div className={styles.right}>
                    <div className={styles.desktopOnly}>
                        <div className={styles.roleToggle}>
                            <button
                                className={`${styles.roleBtn} ${!isAdmin ? styles.active : ''}`}
                                onClick={() => switchRole('member')}
                            >
                                Member
                            </button>
                            <button
                                className={`${styles.roleBtn} ${isAdmin ? styles.active : ''}`}
                                onClick={() => switchRole('admin')}
                            >
                                Admin
                            </button>
                        </div>
                    </div>

                    <Link href="/profile" className={styles.userMenu}>
                        <div className={styles.avatar}>
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.displayName} className={styles.avatarImg} />
                            ) : (
                                user.displayName.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{user.displayName}</span>
                            <span className={styles.userRole}>{user.role}</span>
                        </div>
                    </Link>

                    <button className={styles.settingsBtn} onClick={() => setIsSettingsOpen(true)} title="Settings">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>

                    <button className={styles.logoutBtn} onClick={logout} title="Logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button className={styles.menuToggle} onClick={toggleMenu} aria-label="Toggle Menu">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {isMenuOpen ? (
                                <path d="M18 6L6 18M6 6l12 12" />
                            ) : (
                                <path d="M3 12h18M3 6h18M3 18h18" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Backdrop for mobile menu */}
            {isMenuOpen && (
                <div
                    className={styles.backdrop}
                    onClick={() => setIsMenuOpen(false)}
                    data-testid="menu-backdrop"
                />
            )}

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </header>
    );
}
