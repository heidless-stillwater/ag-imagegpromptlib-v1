'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Backup } from '@/types';
import { getBackups, createBackup, deleteBackup, restoreBackup } from '@/services/backup';
import BackupList from '@/components/backup/BackupList';
import Button from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import styles from './page.module.css';

export default function BackupPage() {
    const { user, isAdmin } = useAuth();
    const [backups, setBackups] = useState<Backup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal states
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
    const [confirmRestore, setConfirmRestore] = useState<{ isOpen: boolean; backup?: Backup }>({ isOpen: false });
    const [confirmUpload, setConfirmUpload] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; variant: 'info' | 'success' | 'danger' }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });

    useEffect(() => {
        if (user) {
            loadBackups();
        }
    }, [user]);

    const loadBackups = async () => {
        setIsLoading(true);
        try {
            const data = await getBackups();
            setBackups(data.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
        } catch (error) {
            console.error('Failed to load backups:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateBackup = async (type: Backup['type']) => {
        setIsProcessing(true);
        try {
            const result = await createBackup(type);
            if (result) {
                await loadBackups();
                setFeedback({
                    isOpen: true,
                    title: 'Backup Created',
                    message: `Backup of "${type}" created and saved to library.`,
                    variant: 'success'
                });
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            setFeedback({
                isOpen: true,
                title: 'Error',
                message: 'Failed to create backup.',
                variant: 'danger'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const confirmDeleteAction = async () => {
        const id = confirmDelete.id;
        setConfirmDelete({ isOpen: false, id: '' });
        try {
            const success = await deleteBackup(id);
            if (success) {
                setBackups(prev => prev.filter(b => b.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete backup:', error);
        }
    };

    const handleRestore = (backup: Backup) => {
        setConfirmRestore({ isOpen: true, backup });
    };

    const confirmRestoreAction = async () => {
        const backup = confirmRestore.backup;
        if (!backup) return;
        setConfirmRestore({ isOpen: false });

        setIsProcessing(true);
        try {
            const result = await restoreBackup(backup.file);
            setFeedback({
                isOpen: true,
                title: 'Restore Complete',
                message: `Successfully restored ${result.restoredPromptSets} prompt sets and ${result.restoredMedia} media items.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Restore failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Restore Failed',
                message: 'Failed to restore from backup.',
                variant: 'danger'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            setConfirmUpload({ isOpen: true, content });
        };
        reader.readAsText(file);
    };

    const confirmUploadAction = async () => {
        const content = confirmUpload.content;
        setConfirmUpload({ isOpen: false, content: '' });

        setIsProcessing(true);
        try {
            const result = await restoreBackup(content);
            setFeedback({
                isOpen: true,
                title: 'Restore Complete',
                message: `Successfully restored ${result.restoredPromptSets} prompt sets and ${result.restoredMedia} media items.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Restore failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Restore Failed',
                message: 'Invalid backup file format.',
                variant: 'danger'
            });
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Backup</h1>
                    <p className={styles.subtitle}>
                        Secure and manage your prompt sets and media assets
                    </p>
                </div>
            </div>

            <div className={styles.operationGrid}>
                <div className={styles.opCard}>
                    <h3>Create Backup</h3>
                    <p>Export your data as a JSON file and store it in your backup collection.</p>
                    <div className={styles.opActions}>
                        <Button variant="secondary" onClick={() => handleCreateBackup('promptSet')} isLoading={isProcessing}>
                            Prompt Sets
                        </Button>
                        <Button variant="secondary" onClick={() => handleCreateBackup('media')} isLoading={isProcessing}>
                            Media Library
                        </Button>
                        <Button variant="primary" onClick={() => handleCreateBackup('all')} isLoading={isProcessing}>
                            Save All
                        </Button>
                    </div>
                </div>

                <div className={styles.opCard}>
                    <h3>Restore from File</h3>
                    <p>Upload a previously downloaded backup file to restore your data.</p>
                    <div className={styles.opActions}>
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={isProcessing}>
                            Upload File
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".json"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            </div>

            <div className={styles.historySection}>
                <h2 className={styles.sectionTitle}>Backup History</h2>
                {isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <p>Loading backups...</p>
                    </div>
                ) : (
                    <BackupList
                        backups={backups}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        isAdminView={isAdmin}
                    />
                )}
            </div>

            {/* Modal Dialogs */}
            <ConfirmationModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
                onConfirm={confirmDeleteAction}
                title="Delete Backup"
                message="Are you sure you want to delete this backup record from the library? This action is permanent."
                variant="danger"
                confirmLabel="Delete"
            />

            <ConfirmationModal
                isOpen={confirmRestore.isOpen}
                onClose={() => setConfirmRestore({ isOpen: false })}
                onConfirm={confirmRestoreAction}
                title="Restore Data"
                message="Restoring will overwrite or merge with existing data. It is highly recommended to create a fresh backup of your current data first. Proceed?"
                variant="info"
                confirmLabel="Restore"
                isLoading={isProcessing}
            />

            <ConfirmationModal
                isOpen={confirmUpload.isOpen}
                onClose={() => setConfirmUpload({ isOpen: false, content: '' })}
                onConfirm={confirmUploadAction}
                title="Restore from File"
                message="Restoring from an uploaded file will merge with your existing data. Proceed?"
                variant="info"
                confirmLabel="Restore"
                isLoading={isProcessing}
            />

            <ConfirmationModal
                isOpen={feedback.isOpen}
                onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                title={feedback.title}
                message={feedback.message}
                variant={feedback.variant}
                confirmLabel="Close"
                cancelLabel=""
            />
        </div>
    );
}
