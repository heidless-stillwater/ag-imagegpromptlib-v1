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
import { generateDeterministicId } from '@/lib/utils';

const COLLECTION_NAME = 'media';

/**
 * Normalizes a URL for deduplication by removing tokens and trailing slashes.
 */
export function normalizeMediaUrl(url: string): string {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        // Aggressive: Remove ALL query params for storage hosts to ensure match
        if (urlObj.hostname.includes('firebasestorage') || urlObj.hostname.includes('googleapis')) {
            urlObj.search = '';
        }
        let normalized = urlObj.toString();
        // Remove trailing slash and decode to ensure encoding differences don't break matching
        normalized = decodeURIComponent(normalized);
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    } catch (e) {
        return url.trim();
    }
}

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
    metadata?: { promptSetId?: string; versionId?: string },
    overwrite: boolean = false
): Promise<MediaImage | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // Firestore document limit is 1MB.
    // If the URL is huge (Base64), we MUST reject it or it will crash the write.
    // 500,000 chars ~ 375KB-500KB depending on encoding, safe buffer.
    if (url.length > 500000) {
        console.warn('Skipping media image: URL is too large for Firestore document (Base64?)', url.substring(0, 50) + '...');
        return null;
    }

    // Generate a deterministic ID based on userId and normalized url
    // This naturally prevents duplicates regardless of URL tokens or formatting
    const normalizedUrl = normalizeMediaUrl(url);
    const id = await generateDeterministicId(`${currentUser.id}-${normalizedUrl}`);

    // Check if duplicate using direct ID lookup (more efficient than query)
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && !overwrite) {
        return docSnap.data() as MediaImage;
    }

    const newImage: MediaImage = {
        id,
        userId: currentUser.id,
        url,
        promptSetId: metadata?.promptSetId,
        versionId: metadata?.versionId,
        createdAt: new Date().toISOString(),
    };

    await setDoc(docRef, sanitizeData(newImage));
    return newImage;
}

/**
 * Check if an image already exists in media
 */
export async function checkMediaExists(url: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const normalizedUrl = normalizeMediaUrl(url);
    const id = await generateDeterministicId(`${currentUser.id}-${normalizedUrl}`);
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    return docSnap.exists();
}

/**
 * Check if a media image ID exists
 */
export async function checkMediaExistsById(id: string): Promise<boolean> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
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
export async function syncImagesFromVersions(): Promise<{ added: number; cleaned: number }> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { added: 0, cleaned: 0 };

    // Fetch current media to identify duplicates or missing items
    const allMedia = await getMediaImages();
    const existingUrls = new Map<string, string>(); // normalized_url -> id
    const duplicatesToDelete: string[] = [];

    // Identify duplicates in existing media using normalized URLs
    allMedia.forEach(img => {
        const norm = normalizeMediaUrl(img.url);
        if (existingUrls.has(norm)) {
            const firstId = existingUrls.get(norm)!;

            // Prefer deterministic IDs (64 chars)
            if (img.id.length !== 64 && firstId.length === 64) {
                duplicatesToDelete.push(img.id);
            } else if (img.id.length === 64 && firstId.length !== 64) {
                duplicatesToDelete.push(firstId);
                existingUrls.set(norm, img.id);
            } else {
                // Both same type, pick the first one and delete the rest
                duplicatesToDelete.push(img.id);
            }
        } else {
            existingUrls.set(norm, img.id);
        }
    });

    // Fetch sets to find new images
    const { getPromptSets } = await import('./promptSets');
    const promptSets = await getPromptSets();

    let addedCount = 0;
    const batch = writeBatch(db);

    for (const set of promptSets) {
        for (const version of set.versions) {
            if (version.imageUrl) {
                const norm = normalizeMediaUrl(version.imageUrl);
                if (!existingUrls.has(norm)) {
                    // Always use current user's ID for normalization consistency in their library
                    const id = await generateDeterministicId(`${currentUser.id}-${norm}`);
                    const docRef = doc(db, COLLECTION_NAME, id);

                    const newImg: MediaImage = {
                        id,
                        userId: set.userId,
                        url: version.imageUrl,
                        promptSetId: set.id,
                        versionId: version.id,
                        createdAt: version.imageGeneratedAt || version.createdAt,
                    };
                    batch.set(docRef, sanitizeData(newImg));
                    existingUrls.set(version.imageUrl, id);
                    addedCount++;
                }
            }
        }
    }

    // Add deletions to batch
    duplicatesToDelete.forEach(id => {
        batch.delete(doc(db, COLLECTION_NAME, id));
    });

    if (addedCount > 0 || duplicatesToDelete.length > 0) {
        await batch.commit();
    }

    return { added: addedCount, cleaned: duplicatesToDelete.length };
}
