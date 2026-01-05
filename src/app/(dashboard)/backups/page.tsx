'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Backup } from '@/types';
import { getBackups, createBackup, deleteBackup, restoreBackup } from '@/services/backup';
import BackupList from '@/components/backup/BackupList';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

export default function BackupPage() {
    const { user, isAdmin } = useAuth();
    const [backups, setBackups] = useState<Backup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                alert(`Backup of "${type}" created successfully.`);
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            alert('Failed to create backup.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this backup record from the library?')) return;

        try {
            const success = await deleteBackup(id);
            if (success) {
                setBackups(prev => prev.filter(b => b.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete backup:', error);
        }
    };

    const handleRestore = async (backup: Backup) => {
        if (!confirm('Proceeding will overwrite or merge with existing data. Highly recommended to create a fresh backup first. Proceed?')) return;

        setIsProcessing(true);
        try {
            const result = await restoreBackup(backup.file);
            alert(`Restore complete!\nRestored ${result.restoredPromptSets} prompt sets and ${result.restoredMedia} media items.`);
        } catch (error) {
            console.error('Restore failed:', error);
            alert('Failed to restore from backup.');
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
            if (!confirm('Restoring from file will merge with existing data. Proceed?')) return;

            setIsProcessing(true);
            try {
                const result = await restoreBackup(content);
                alert(`Restore complete!\nRestored ${result.restoredPromptSets} prompt sets and ${result.restoredMedia} media items.`);
            } catch (error) {
                console.error('Restore failed:', error);
                alert('Invalid backup file format.');
            } finally {
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
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
        </div>
    );
}
