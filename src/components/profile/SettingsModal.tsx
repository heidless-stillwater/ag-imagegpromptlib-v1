'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/services/auth';
import AspectRatioExplorer from './AspectRatioExplorer';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'general' | 'aspect-ratios';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (isOpen) {
            setGeminiApiKey(user?.settings?.geminiApiKey || 'AIzaSyA9ljr_ryKxbtlTPwemOQ62NhOMTcGrOig');
            setMessage(null);
            setActiveTab('general');
        }
    }, [isOpen, user]);


    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const updatedSettings = {
                ...user.settings,
                geminiApiKey: geminiApiKey.trim(),
            };

            const result = await updateUserProfile(user.id, {
                settings: updatedSettings
            });

            if (result) {
                setMessage({ text: 'Settings saved successfully!', type: 'success' });
                // Keep modal open for a moment to show success message
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setMessage({ text: 'Failed to save settings. Please try again.', type: 'error' });
            }
        } catch (error) {
            console.error('Save settings error:', error);
            setMessage({ text: 'An error occurred while saving.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="User Settings" size="lg">
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'general' ? styles.active : ''}`}
                    onClick={() => setActiveTab('general')}
                >
                    General
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'aspect-ratios' ? styles.active : ''}`}
                    onClick={() => setActiveTab('aspect-ratios')}
                >
                    Aspect Ratios
                </button>
            </div>

            <div className={styles.settingsContent}>
                {activeTab === 'general' ? (
                    <>
                        <div className={styles.settingGroup}>
                            <label htmlFor="geminiApiKey">Gemini API Key</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="geminiApiKey"
                                    type="password"
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKey(e.target.value)}
                                    placeholder="Enter your Gemini API Key"
                                    autoComplete="off"
                                />
                            </div>
                            <p className={styles.helperText}>
                                Used for AI image prompt generation and assistant features.
                            </p>
                            {(!geminiApiKey || geminiApiKey === '') && (
                                <p className={styles.helperText} style={{ color: 'var(--accent-primary)', cursor: 'pointer' }}
                                    onClick={() => setGeminiApiKey('AIzaSyA9ljr_ryKxbtlTPwemOQ62NhOMTcGrOig')}>
                                    Click to use standard key: AIzaSyA9ljr_ryKxbtlTPwemOQ62NhOMTcGrOig
                                </p>
                            )}
                        </div>

                        {message && (
                            <div className={message.type === 'success' ? styles.success : styles.error}>
                                {message.text}
                            </div>
                        )}

                        <div className={styles.actions}>
                            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                                Save Settings
                            </Button>
                        </div>
                    </>
                ) : (
                    <AspectRatioExplorer />
                )}
            </div>
        </Modal>
    );
}
