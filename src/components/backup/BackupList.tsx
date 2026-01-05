'use client';

import { Backup } from '@/types';
import Button from '@/components/ui/Button';
import { downloadBackupFile } from '@/services/backup';
import styles from './BackupList.module.css';

interface BackupListProps {
    backups: Backup[];
    onDelete: (id: string) => void;
    onRestore: (backup: Backup) => void;
    isAdminView?: boolean;
}

export default function BackupList({ backups, onDelete, onRestore, isAdminView = false }: BackupListProps) {
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
                        <tr key={backup.id} className={styles.row}>
                            <td>{new Date(backup.createdAt).toLocaleString()}</td>
                            <td>
                                <span className={`${styles.typeBadge} ${styles[backup.type]}`}>
                                    {backup.type}
                                </span>
                            </td>
                            <td className={styles.fileName}>{backup.fileName}</td>
                            {isAdminView && <td className={styles.userId}>{backup.userId.slice(0, 8)}...</td>}
                            <td className={styles.actions}>
                                <Button size="sm" variant="secondary" onClick={() => downloadBackupFile(backup)}>
                                    Download
                                </Button>
                                <Button size="sm" variant="success" onClick={() => onRestore(backup)}>
                                    Restore
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => onDelete(backup.id)}>
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
