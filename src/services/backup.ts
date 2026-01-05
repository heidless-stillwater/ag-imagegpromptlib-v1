import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Backup, PromptSet, MediaImage } from '@/types';
import { getCurrentUser, isAdmin } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'backups';

/**
 * Get all backups
 */
export async function getBackups(): Promise<Backup[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const adminMode = await isAdmin();
    const colRef = collection(db, COLLECTION_NAME);

    let q;
    if (adminMode) {
        q = query(colRef, orderBy('createdAt', 'desc'));
    } else {
        q = query(colRef, where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Backup);
}

/**
 * Create a new backup
 */
export async function createBackup(type: Backup['type']): Promise<Backup | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // We import directly to avoid circular dependency
    const { getPromptSets } = await import('./promptSets');
    const { getMediaImages } = await import('./media');

    let backupData: any = {};

    if (type === 'promptSet' || type === 'all') {
        const promptSets = await getPromptSets();
        backupData.promptSets = promptSets;
    }

    if (type === 'media' || type === 'all') {
        const media = await getMediaImages();
        backupData.media = media;
    }

    const jsonString = JSON.stringify(backupData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userPrefix = (currentUser.username || currentUser.displayName || 'user').toLowerCase().replace(/\s+/g, '-');
    const fileName = `${userPrefix}-backup-${type}-${timestamp}.json`;

    const id = generateId();
    const newBackup: Backup = {
        id,
        userId: currentUser.id,
        type,
        file: jsonString,
        fileName,
        createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(newBackup));
    return newBackup;
}

/**
 * Delete backup
 */
export async function deleteBackup(id: string): Promise<boolean> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    return true;
}

/**
 * Restore backup
 */
export async function restoreBackup(backupJson: string): Promise<{ restoredPromptSets: number; restoredMedia: number }> {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('You must be logged in to restore a backup');

    // Parse once to simple JSON
    let data;
    try {
        data = JSON.parse(backupJson);
    } catch (e) {
        console.error('Failed to parse backup JSON', e);
        throw new Error('Invalid backup file format');
    }

    let restoredPromptSets = 0;
    let restoredMedia = 0;

    const { addMediaImage } = await import('./media');

    // Strict Restoration for PromptSets
    if (data.promptSets && Array.isArray(data.promptSets)) {
        for (const rawSet of data.promptSets) {
            try {
                // Manually construct versions to ensuring strict shape
                // Use empty strings instead of null/undefined to avoid any Firestore array issues
                const safeVersions = (Array.isArray(rawSet.versions) ? rawSet.versions : []).map((v: any) => ({
                    id: String(v.id || generateId()),
                    promptSetId: String(rawSet.id),
                    versionNumber: Number(v.versionNumber) || 1,
                    promptText: String(v.promptText || ''),
                    imageUrl: v.imageUrl ? String(v.imageUrl) : '',
                    imageGeneratedAt: v.imageGeneratedAt ? String(v.imageGeneratedAt) : '',
                    notes: v.notes ? String(v.notes) : '',
                    createdAt: v.createdAt ? String(v.createdAt) : new Date().toISOString(),
                    updatedAt: v.updatedAt ? String(v.updatedAt) : new Date().toISOString(),
                }));

                // Strict PromptSet Construction - Base fields only first
                const baseRestoredSet: PromptSet = {
                    id: String(rawSet.id || generateId()),
                    userId: currentUser.id,
                    title: String(rawSet.title || 'Untitled Restoration'),
                    description: rawSet.description ? String(rawSet.description) : '',
                    categoryId: rawSet.categoryId ? String(rawSet.categoryId) : '',
                    notes: rawSet.notes ? String(rawSet.notes) : '',
                    versions: [], // Empty initially
                    createdAt: rawSet.createdAt ? String(rawSet.createdAt) : new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Step 1: Save base document
                console.log('Restoring Base Set:', baseRestoredSet.id);
                await setDoc(doc(db, 'promptSets', baseRestoredSet.id), baseRestoredSet);

                // Step 2: Update with versions
                try {
                    console.log('Appending versions to:', baseRestoredSet.id, safeVersions.length);
                    // We must cast safeVersions to any because strict Typescript might complain 
                    // about matching exact PromptVersion type if we changed nulls to strings,
                    // but Firestore doesn't care.
                    await updateDoc(doc(db, 'promptSets', baseRestoredSet.id), {
                        versions: safeVersions
                    });
                    restoredPromptSets++;
                } catch (versionErr) {
                    console.error('Failed to append versions for set:', baseRestoredSet.id, versionErr);
                    // We still count it as effectively restored, just incomplete
                }
            } catch (err) {
                console.error('Failed to restore prompt set:', rawSet?.id, err);
                // Continue to next item instead of crashing entire restore
            }
        }
    }

    // Strict Restoration for Media
    if (data.media && Array.isArray(data.media)) {
        for (const rawImg of data.media) {
            try {
                if (!rawImg.url) continue;

                // addMediaImage handles duplicates and basic structure
                await addMediaImage(String(rawImg.url), {
                    promptSetId: rawImg.promptSetId ? String(rawImg.promptSetId) : undefined,
                    versionId: rawImg.versionId ? String(rawImg.versionId) : undefined
                });
                restoredMedia++;
            } catch (err) {
                console.error('Failed to restore media:', rawImg?.id, err);
            }
        }
    }

    return { restoredPromptSets, restoredMedia };
}

/**
 * Download
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
