'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/services/auth';
import styles from './ResetPasswordModal.module.css';

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
    const { user, refreshUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!user) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.currentPassword) {
            setError('Current password is required');
            return;
        }

        if (formData.newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        // For mock auth, we check if currentPassword matches user.password 
        if (user.password && formData.currentPassword !== user.password) {
            setError('Incorrect current password');
            return;
        }

        setIsSaving(true);
        try {
            const updatedUser = await updateUserProfile(user.id, {
                password: formData.newPassword
            });

            if (updatedUser) {
                if (refreshUser) await refreshUser();
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    onClose();
                }, 2000);
            } else {
                setError('Failed to update password');
            }
        } catch (err) {
            console.error('Password update error:', err);
            setError('An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Reset Password"
            size="md"
        >
            {success ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>✅</div>
                    <h3>Password Updated!</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>Closing window...</p>
                </div>
            ) : (
                <form onSubmit={handleReset} className={styles.modalContent}>
                    <div className={styles.field}>
                        <label htmlFor="currentPassword">Current Password</label>
                        <input
                            type="password"
                            id="currentPassword"
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            required
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="newPassword">New Password</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                id="newPassword"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleChange}
                                required
                                className={styles.input}
                                placeholder="At least 6 characters"
                            />
                            <button
                                type="button"
                                className={styles.showToggle}
                                onClick={() => setShowNew(!showNew)}
                            >
                                {showNew ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="confirmPassword">Confirm New Password</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className={styles.input}
                            />
                            <button
                                type="button"
                                className={styles.showToggle}
                                onClick={() => setShowConfirm(!showConfirm)}
                            >
                                {showConfirm ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.actions}>
                        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSaving}>
                            Update Password
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
