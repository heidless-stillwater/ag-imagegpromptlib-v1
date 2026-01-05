import { Backup, PromptSet, MediaImage } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser, isAdmin } from './auth';

/**
 * Get all backups for current user
 * Admin sees all backups
 */
export async function getBackups(): Promise<Backup[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const allBackups = await getCollection<Backup>(STORAGE_KEYS.BACKUPS);
    const adminMode = await isAdmin();

    if (adminMode) return allBackups;

    return allBackups.filter(b => b.userId === currentUser.id);
}

/**
 * Create a new backup
 */
export async function createBackup(type: Backup['type']): Promise<Backup | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    let backupData: any = {};

    if (type === 'promptSet' || type === 'all') {
        const promptSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
        backupData.promptSets = promptSets.filter(s => s.userId === currentUser.id);
    }

    if (type === 'media' || type === 'all') {
        const media = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);
        backupData.media = media.filter(m => m.userId === currentUser.id);
    }

    const jsonString = JSON.stringify(backupData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${type}-${timestamp}.json`;

    const newBackup: Backup = {
        id: generateId(),
        userId: currentUser.id,
        type,
        file: jsonString,
        fileName,
        createdAt: getTimestamp(),
    };

    const backups = await getCollection<Backup>(STORAGE_KEYS.BACKUPS);
    await setCollection(STORAGE_KEYS.BACKUPS, [...backups, newBackup]);

    return newBackup;
}

/**
 * Delete a backup from the collection
 */
export async function deleteBackup(id: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const backups = await getCollection<Backup>(STORAGE_KEYS.BACKUPS);
    const backup = backups.find(b => b.id === id);

    if (!backup) return false;

    // Check permission: admin or owner
    const adminMode = await isAdmin();
    if (!adminMode && backup.userId !== currentUser.id) {
        return false;
    }

    const filtered = backups.filter(b => b.id !== id);
    await setCollection(STORAGE_KEYS.BACKUPS, filtered);
    return true;
}

/**
 * Restore data from a backup string
 */
export async function restoreBackup(backupJson: string): Promise<{ restoredPromptSets: number; restoredMedia: number }> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { restoredPromptSets: 0, restoredMedia: 0 };

    try {
        const data = JSON.parse(backupJson);
        let restoredPromptSets = 0;
        let restoredMedia = 0;

        // Restore Prompt Sets
        if (data.promptSets && Array.isArray(data.promptSets)) {
            const currentPromptSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
            const newSets = [...currentPromptSets];

            for (const backupSet of data.promptSets) {
                const index = newSets.findIndex(s => s.id === backupSet.id);
                if (index !== -1) {
                    newSets[index] = backupSet; // Overwrite
                } else {
                    newSets.push(backupSet);
                    restoredPromptSets++;
                }
            }
            await setCollection(STORAGE_KEYS.PROMPT_SETS, newSets);
        }

        // Restore Media
        if (data.media && Array.isArray(data.media)) {
            const currentMedia = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);
            const newMedia = [...currentMedia];

            for (const backupImg of data.media) {
                const index = newMedia.findIndex(m => m.id === backupImg.id);
                if (index !== -1) {
                    newMedia[index] = backupImg; // Overwrite
                } else {
                    newMedia.push(backupImg);
                    restoredMedia++;
                }
            }
            await setCollection(STORAGE_KEYS.MEDIA, newMedia);
        }

        return { restoredPromptSets, restoredMedia };
    } catch (error) {
        console.error('Failed to restore backup:', error);
        throw new Error('Invalid backup file format');
    }
}

/**
 * Helper to download a backup as a file
 */
export function downloadBackupFile(backup: Backup) {
    if (typeof window === 'undefined') return;

    const blob = new Blob([backup.file], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
