'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/services/auth';
import { getMediaImages, addMediaImage } from '@/services/media';
import { generateImage } from '@/services/gemini';
import { uploadUserAvatar } from '@/services/upload';
import { MediaImage } from '@/types';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ResetPasswordModal from '@/components/profile/ResetPasswordModal';
import styles from './page.module.css';

export default function ProfilePage() {
    const { user, switchRole, refreshUser } = useAuth();

    const [formData, setFormData] = useState({
        displayName: '',
        username: '',
        loginName: '',
        email: '',
        role: 'member' as 'admin' | 'member',
        avatarUrl: '',
        avatarPrompt: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Avatar states
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [mediaImages, setMediaImages] = useState<MediaImage[]>([]);
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    const [needsGenConfirmation, setNeedsGenConfirmation] = useState(false);
    const [avatarPrompt, setAvatarPrompt] = useState('');
    const [feedback, setFeedback] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'info' | 'success' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                username: user.username || '',
                loginName: user.loginName || '',
                email: user.email || '',
                role: user.role || 'member',
                avatarUrl: user.avatarUrl || '',
                avatarPrompt: user.avatarPrompt || '',
            });
            setAvatarPrompt(user.avatarPrompt || '');
        }
    }, [user]);

    if (!user) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const updates: any = {
                displayName: formData.displayName,
                username: formData.username,
                loginName: formData.loginName,
                email: formData.email,
                role: formData.role,
                avatarUrl: formData.avatarUrl,
                avatarPrompt: avatarPrompt,
            };

            const updatedUser = await updateUserProfile(user.id, updates);

            if (updatedUser) {
                if (refreshUser) await refreshUser();
                setMessage({ type: 'success', text: 'Profile updated successfully!' });

                // If role changed, ensure context is aware 
                if (formData.role !== user.role) {
                    await switchRole(formData.role);
                }
            } else {
                setMessage({ type: 'error', text: 'Failed to update profile.' });
            }
        } catch (error) {
            console.error('Profile update error:', error);
            setMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;

            try {
                // Upload to Firebase Storage first
                // Use a toast or loading state ideally, but for now we proceed
                const storageUrl = await uploadUserAvatar(user.id, base64);

                setFormData(prev => ({ ...prev, avatarUrl: storageUrl }));
                // Also save to Media library with the permanent URL
                await addMediaImage(storageUrl);
            } catch (error) {
                console.error('Failed to upload avatar:', error);
                setMessage({ type: 'error', text: 'Failed to upload image. Please try again.' });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateAvatar = async () => {
        if (!avatarPrompt.trim()) return;

        if (!needsGenConfirmation) {
            setNeedsGenConfirmation(true);
            return;
        }

        setNeedsGenConfirmation(false);
        setIsGeneratingAvatar(true);
        try {
            const result = await generateImage(avatarPrompt, 'live', false, user?.settings?.geminiApiKey);
            if (result.success && result.imageUrl) {
                try {
                    // Upload generated base64 to Storage
                    const storageUrl = await uploadUserAvatar(user.id, result.imageUrl);

                    setFormData(prev => ({ ...prev, avatarUrl: storageUrl }));
                    // Save to Media library with permanent URL
                    await addMediaImage(storageUrl);
                } catch (uploadError) {
                    console.error('Failed to upload generated avatar:', uploadError);
                    setFeedback({
                        isOpen: true,
                        title: 'Upload Failed',
                        message: 'Generated image, but failed to save to storage.',
                        variant: 'danger'
                    });
                }
            } else {
                setFeedback({
                    isOpen: true,
                    title: 'Generation Failed',
                    message: result.error || 'Failed to generate avatar',
                    variant: 'danger'
                });
            }
        } catch (error) {
            console.error('Avatar generation error:', error);
            setFeedback({
                isOpen: true,
                title: 'Error',
                message: 'Failed to generate avatar. Please try again.',
                variant: 'danger'
            });
        } finally {
            setIsGeneratingAvatar(false);
        }
    };

    const openMediaSelector = async () => {
        const images = await getMediaImages();
        setMediaImages(images);
        setIsMediaModalOpen(true);
    };

    const selectFromMedia = (url: string) => {
        setFormData(prev => ({ ...prev, avatarUrl: url }));
        setIsMediaModalOpen(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Your Profile</h1>
                <p className={styles.subtitle}>Manage your account information and identity</p>
            </div>

            <div className={styles.card}>
                <div className={styles.avatarSection}>
                    <div className={styles.avatarPreview}>
                        {formData.avatarUrl ? (
                            <img src={formData.avatarUrl} alt="Avatar" className={styles.avatarImage} />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                {formData.displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className={styles.avatarActions}>
                        <h3>Avatar Customization</h3>
                        <div className={styles.actionGrid}>
                            <div className={styles.actionCard}>
                                <h4>✨ NanoBanana AI</h4>
                                <p className={styles.modelInfo}>gemini-2.5-flash-image</p>
                                <div className={styles.aiAction}>
                                    <input
                                        type="text"
                                        placeholder="Describe your avatar..."
                                        value={avatarPrompt}
                                        onChange={(e) => {
                                            setAvatarPrompt(e.target.value);
                                            setNeedsGenConfirmation(false);
                                        }}
                                        className={styles.miniInput}
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleGenerateAvatar}
                                        isLoading={isGeneratingAvatar}
                                        disabled={!avatarPrompt.trim()}
                                        variant={needsGenConfirmation ? 'primary' : 'secondary'}
                                    >
                                        {needsGenConfirmation ? 'Confirm Submission' : 'Generate'}
                                    </Button>
                                    {needsGenConfirmation && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => setNeedsGenConfirmation(false)}
                                            disabled={isGeneratingAvatar}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={styles.actionCard}>
                                <h4>🖼️ Library</h4>
                                <Button variant="secondary" size="sm" onClick={openMediaSelector}>
                                    Select Image
                                </Button>
                            </div>

                            <div className={styles.actionCard}>
                                <h4>📁 Upload</h4>
                                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                    Choose File
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className={styles.form}>
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label htmlFor="displayName">Display Name</label>
                            <input
                                type="text"
                                id="displayName"
                                name="displayName"
                                value={formData.displayName}
                                onChange={handleInputChange}
                                required
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleInputChange}
                                className={styles.input}
                                placeholder="Unique handle"
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.field}>
                            <label htmlFor="role">Account Role</label>
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleInputChange}
                                className={styles.select}
                            >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div className={styles.field}>
                            <label>Account Security</label>
                            <div className={styles.passwordAction}>
                                <p className={styles.passwordHint}>Update your login credentials</p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsPasswordModalOpen(true)}
                                >
                                    Change Password
                                </Button>
                            </div>
                        </div>
                    </div>

                    {message.text && (
                        <div className={`${styles.message} ${styles[message.type]}`}>
                            {message.text}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <Button type="submit" isLoading={isSaving} size="lg">
                            Save Profile Changes
                        </Button>
                    </div>
                </form>
            </div>

            <Modal isOpen={isMediaModalOpen} onClose={() => setIsMediaModalOpen(false)} title="Select Avatar from Media" size="lg">
                <div className={styles.mediaGrid}>
                    {mediaImages.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
                            No images in library. Generated avatars will appear here.
                        </p>
                    ) : (
                        mediaImages.map(img => (
                            <div key={img.id} className={styles.mediaItem} onClick={() => selectFromMedia(img.url)}>
                                <img src={img.url} alt="Media" className={styles.mediaImage} />
                            </div>
                        ))
                    )}
                </div>
            </Modal>

            <ResetPasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />

            <ConfirmationModal
                isOpen={feedback.isOpen}
                onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                title={feedback.title}
                message={feedback.message}
                variant={feedback.variant}
                confirmLabel="Got It.."
                cancelLabel=""
            />
        </div>
    );
}
