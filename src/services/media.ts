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
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MediaImage, PromptSet } from '@/types';
import { getCurrentUser, isAdmin } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'media';

/**
 * Get all media images for current user
 */
export async function getMediaImages(): Promise<MediaImage[]> {
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
    return snapshot.docs.map(doc => doc.data() as MediaImage);
}

/**
 * Add a new image
 */
export async function addMediaImage(
    url: string,
    metadata?: { promptSetId?: string; versionId?: string }
): Promise<MediaImage | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // Check if duplicate
    // Firestore query limit for field values is roughly 1MB, but practical index limits are smaller.
    // Also, the entire document cannot exceed 1MB.
    // If the URL is huge (Base64), we MUST reject it or it will crash the write.
    // 500,000 chars ~ 375KB-500KB depending on encoding, safe buffer.
    if (url.length > 500000) {
        console.warn('Skipping media image: URL is too large for Firestore document (Base64?)', url.substring(0, 50) + '...');
        return null;
    }

    if (url.length < 2000) {
        const colRef = collection(db, COLLECTION_NAME);
        const q = query(colRef, where('userId', '==', currentUser.id), where('url', '==', url));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            return snapshot.docs[0].data() as MediaImage;
        }
    }

    const id = generateId();
    const newImage: MediaImage = {
        id,
        userId: currentUser.id,
        url,
        promptSetId: metadata?.promptSetId,
        versionId: metadata?.versionId,
        createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(newImage));
    return newImage;
}

/**
 * Delete image
 */
export async function deleteMediaImage(id: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return false;
    const image = docSnap.data() as MediaImage;

    const adminMode = await isAdmin();
    if (!adminMode && image.userId !== currentUser.id) return false;

    await deleteDoc(docRef);
    return true;
}

/**
 * Bulk delete
 */
export async function deleteMediaImages(ids: string[]): Promise<boolean> {
    const batch = writeBatch(db);
    for (const id of ids) {
        batch.delete(doc(db, COLLECTION_NAME, id));
    }
    await batch.commit();
    return true;
}

/**
 * Sync from versions
 */
export async function syncImagesFromVersions(): Promise<{ added: number }> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { added: 0 };

    // This is a bit complex in Firestore because we can't easily query all versions across all sets 
    // without a separate versions collection. 
    // For now, we fetch the sets and do it in memory, which is fine for moderate data.

    // We import directly to avoid circular dependency
    const { getPromptSets } = await import('./promptSets');
    const promptSets = await getPromptSets();

    const existingMedia = await getMediaImages();
    const existingUrls = new Set(existingMedia.map(m => m.url));

    let addedCount = 0;
    const batch = writeBatch(db);

    for (const set of promptSets) {
        for (const version of set.versions) {
            if (version.imageUrl && !existingUrls.has(version.imageUrl)) {
                const id = generateId();
                const newImg: MediaImage = {
                    id,
                    userId: set.userId,
                    url: version.imageUrl,
                    promptSetId: set.id,
                    versionId: version.id,
                    createdAt: version.imageGeneratedAt || version.createdAt,
                };
                batch.set(doc(db, COLLECTION_NAME, id), sanitizeData(newImg));
                existingUrls.add(version.imageUrl);
                addedCount++;
            }
        }
    }

    if (addedCount > 0) {
        await batch.commit();
    }

    return { added: addedCount };
}
