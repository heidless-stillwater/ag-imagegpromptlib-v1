'use client';

import { useState } from 'react';
import { Backup } from '@/types';
import Button from '@/components/ui/Button';
import { downloadBackupFile } from '@/services/backup';
import styles from './BackupList.module.css';

interface BackupListProps {
    backups: Backup[];
    onDelete: (id: string) => Promise<void> | void;
    onRestore: (backup: Backup) => Promise<void> | void;
    isAdminView?: boolean;
    processingAction?: string | null;
}

export default function BackupList({ backups, onDelete, onRestore, isAdminView = false, processingAction = null }: BackupListProps) {
    if (backups.length === 0) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyIcon}>📦</span>
                <h3>No backups found</h3>
                <p>Create a backup to protect your data or restore from a previous one.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Filename</th>
                        {isAdminView && <th>User</th>}
                        <th className={styles.actionsHeader}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {backups.map(backup => (
                        <BackupRow
                            key={backup.id}
                            backup={backup}
                            onDelete={onDelete}
                            onRestore={onRestore}
                            isAdminView={isAdminView}
                            processingAction={processingAction}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface BackupRowProps {
    backup: Backup;
    onDelete: (id: string) => Promise<void> | void;
    onRestore: (backup: Backup) => Promise<void> | void;
    isAdminView: boolean;
    processingAction: string | null;
}

function BackupRow({ backup, onDelete, onRestore, isAdminView, processingAction }: BackupRowProps) {
    const [loadingLocal, setLoadingLocal] = useState<string | null>(null);

    // Row is "loading" if either a local action is running OR a page-level action for THIS row is running
    const isRowProcessing = (action: string) => {
        const actionKey = `${backup.id}-${action}`;
        return loadingLocal === action || processingAction === `restore-${backup.id}` && action === 'restore' || processingAction === `delete-${backup.id}` && action === 'delete';
    };

    const handleAction = async (action: string, callback: () => Promise<void> | void) => {
        // If it's a "confirmable" action like restore or delete, we don't set local loading here
        // because the modal handles the duration. We only set local loading for direct actions like download.
        if (action === 'download') {
            setLoadingLocal(action);
            try {
                await callback();
            } finally {
                setLoadingLocal(null);
            }
        } else {
            await callback();
        }
    };

    const anyProcessing = !!loadingLocal || processingAction === `restore-${backup.id}` || processingAction === `delete-${backup.id}` || (processingAction && !processingAction.includes(backup.id));

    return (
        <tr className={styles.row}>
            <td>{new Date(backup.createdAt).toLocaleString()}</td>
            <td>
                <span className={`${styles.typeBadge} ${styles[backup.type]}`}>
                    {backup.type}
                </span>
            </td>
            <td className={styles.fileName}>{backup.fileName}</td>
            {isAdminView && <td className={styles.userId}>{backup.userId.slice(0, 8)}...</td>}
            <td className={styles.actions}>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAction('download', () => downloadBackupFile(backup))}
                    isLoading={isRowProcessing('download')}
                    disabled={!!processingAction || !!loadingLocal}
                >
                    Download
                </Button>
                <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleAction('restore', () => onRestore(backup))}
                    isLoading={isRowProcessing('restore')}
                    disabled={!!processingAction || !!loadingLocal}
                >
                    Restore
                </Button>
                <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction('delete', () => onDelete(backup.id))}
                    isLoading={isRowProcessing('delete')}
                    disabled={!!processingAction || !!loadingLocal}
                >
                    Delete
                </Button>
            </td>
        </tr>
    );
}
