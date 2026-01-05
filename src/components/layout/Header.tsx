'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './Header.module.css';

export default function Header() {
    const { user, isAdmin, logout, switchRole } = useAuth();
    const { unreadCount } = useNotifications();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                        <Link href="/dashboard" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
                            Dashboard
                        </Link>
                        <Link href="/media" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
                            Media
                        </Link>
                        <Link href="/backups" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
                            Backup
                        </Link>
                        <Link href="/shares" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
                            Shares
                            {unreadCount > 0 && (
                                <span className={styles.badge}>{unreadCount}</span>
                            )}
                        </Link>
                        {isAdmin && (
                            <Link href="/admin" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
                                Admin
                            </Link>
                        )}

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

                    <div className={styles.userMenu}>
                        <div className={styles.avatar}>
                            {user.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{user.displayName}</span>
                            <span className={styles.userRole}>{user.role}</span>
                        </div>
                    </div>

                    <button className={styles.logoutBtn} onClick={logout}>
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
            {isMenuOpen && <div className={styles.backdrop} onClick={() => setIsMenuOpen(false)} />}
        </header>
    );
}
