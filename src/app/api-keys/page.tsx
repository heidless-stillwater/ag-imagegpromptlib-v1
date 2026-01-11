'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { ApiKey } from '@/types';
import styles from './api-keys.module.css';

export default function ApiKeysPage() {
    const { user } = useAuth();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyDescription, setNewKeyDescription] = useState('');
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadKeys();
        }
    }, [user]);

    const loadKeys = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // For now, we'll fetch from Firestore directly
            // In production, you'd use the API endpoint with an existing key
            const { getApiKeys } = await import('@/services/apiKeys');
            const apiKeys = await getApiKeys();
            setKeys(apiKeys);
        } catch (err) {
            console.error('Error loading API keys:', err);
            setError('Failed to load API keys');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName.trim()) {
            setError('Please enter a key name');
            return;
        }

        if (!user) {
            setError('You must be logged in to create an API key');
            return;
        }

        try {
            setError(null);

            // Determine which endpoint to use
            const isFirstKey = keys.length === 0;
            const endpoint = isFirstKey ? '/api/keys/bootstrap' : '/api/keys';

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Get the current user's ID token for authentication
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const body = isFirstKey
                ? {
                    userId: user.id,
                    name: newKeyName,
                    description: newKeyDescription,
                }
                : {
                    name: newKeyName,
                    description: newKeyDescription,
                };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            // Check if response is JSON before parsing
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Handle non-JSON response (like 500 HTML error page)
                const text = await response.text();
                console.error('Non-JSON response received:', text);
                setError(`Server Error (${response.status}): The server returned an unexpected response format. This usually indicates a configuration issue.`);
                return;
            }

            if (data.success) {
                setCreatedKey(data.data.fullKey);
                setNewKeyName('');
                setNewKeyDescription('');
                await loadKeys();
            } else {
                setError(data.error || 'Failed to create API key');
            }
        } catch (err) {
            console.error('Error creating API key:', err);
            setError(`Failed to create API key: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleDeleteKey = async (keyId: string) => {
        if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            return;
        }

        try {
            setError(null);
            const { deleteApiKey } = await import('@/services/apiKeys');
            const success = await deleteApiKey(keyId);

            if (success) {
                await loadKeys();
            } else {
                setError('Failed to delete API key');
            }
        } catch (err) {
            console.error('Error deleting API key:', err);
            setError('Failed to delete API key');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    const closeCreatedKeyModal = () => {
        setCreatedKey(null);
        setShowCreateModal(false);
    };

    if (!user) {
        return <div className={styles.container}>Please log in to manage API keys.</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>API Keys</h1>
                    <p className={styles.subtitle}>
                        Manage your API keys for programmatic access to your prompt sets and versions.
                    </p>
                </div>
                <button
                    className={styles.createBtn}
                    onClick={() => setShowCreateModal(true)}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create New Key
                </button>
            </div>

            {error && (
                <div className={styles.error}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className={styles.loading}>Loading API keys...</div>
            ) : keys.length === 0 ? (
                <div className={styles.empty}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    <h2>No API Keys</h2>
                    <p>Create your first API key to get started with programmatic access.</p>
                    <button
                        className={styles.createBtnLarge}
                        onClick={() => setShowCreateModal(true)}
                    >
                        Create Your First Key
                    </button>
                </div>
            ) : (
                <div className={styles.keysList}>
                    {keys.map((key) => (
                        <div key={key.id} className={styles.keyCard}>
                            <div className={styles.keyHeader}>
                                <div className={styles.keyIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                    </svg>
                                </div>
                                <div className={styles.keyInfo}>
                                    <h3 className={styles.keyName}>{key.name}</h3>
                                    {key.description && (
                                        <p className={styles.keyDescription}>{key.description}</p>
                                    )}
                                </div>
                            </div>

                            <div className={styles.keyDetails}>
                                <div className={styles.keyValue}>
                                    <span className={styles.label}>Key:</span>
                                    <code className={styles.code}>{key.keyPrefix}</code>
                                </div>

                                <div className={styles.keyMeta}>
                                    <div className={styles.metaItem}>
                                        <span className={styles.label}>Created:</span>
                                        <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {key.lastUsed && (
                                        <div className={styles.metaItem}>
                                            <span className={styles.label}>Last used:</span>
                                            <span>{new Date(key.lastUsed).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.keyActions}>
                                <button
                                    className={styles.deleteBtn}
                                    onClick={() => handleDeleteKey(key.id)}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Key Modal */}
            {showCreateModal && !createdKey && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>Create New API Key</h2>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setShowCreateModal(false)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label htmlFor="keyName">Name *</label>
                                <input
                                    id="keyName"
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g., Production API Key"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="keyDescription">Description</label>
                                <textarea
                                    id="keyDescription"
                                    className={styles.textarea}
                                    placeholder="Optional description for this key"
                                    value={newKeyDescription}
                                    onChange={(e) => setNewKeyDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <div className={styles.warning}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <p>The API key will only be shown once. Make sure to copy and store it securely.</p>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.submitBtn}
                                onClick={handleCreateKey}
                            >
                                Create Key
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Created Key Modal */}
            {createdKey && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>API Key Created!</h2>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.success}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                <p>Your API key has been created successfully!</p>
                            </div>

                            <div className={styles.keyDisplay}>
                                <label>Your API Key</label>
                                <div className={styles.keyValueDisplay}>
                                    <code>{createdKey}</code>
                                    <button
                                        className={styles.copyBtn}
                                        onClick={() => copyToClipboard(createdKey)}
                                        title="Copy to clipboard"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className={styles.warning}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <p><strong>Important:</strong> This is the only time you'll see this key. Copy it now and store it securely.</p>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.submitBtn}
                                onClick={closeCreatedKeyModal}
                            >
                                I've Saved My Key
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
