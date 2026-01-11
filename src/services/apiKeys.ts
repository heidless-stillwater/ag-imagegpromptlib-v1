import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ApiKey } from '@/types';
import { getCurrentUser } from './auth';
import { generateId } from './storage';

const COLLECTION_NAME = 'apiKeys';

/**
 * This is a CLIENT-SIDE service for API key management UI.
 * The actual key generation and hashing happens server-side in the API route.
 */

/**
 * Get all API keys for the current user
 * Note: This returns keys without the actual key value (only prefix shown)
 */
export async function getApiKeys(): Promise<ApiKey[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
        colRef,
        where('userId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ApiKey);
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    // Verify ownership
    const keys = await getApiKeys();
    const keyToDelete = keys.find(k => k.id === keyId);
    if (!keyToDelete || keyToDelete.userId !== currentUser.id) {
        return false;
    }

    await deleteDoc(doc(db, COLLECTION_NAME, keyId));
    return true;
}

/**
 * Update API key metadata (name, description)
 */
export async function updateApiKey(
    keyId: string,
    updates: { name?: string; description?: string }
): Promise<ApiKey | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // Verify ownership
    const keys = await getApiKeys();
    const keyToUpdate = keys.find(k => k.id === keyId);
    if (!keyToUpdate || keyToUpdate.userId !== currentUser.id) {
        return null;
    }

    await updateDoc(doc(db, COLLECTION_NAME, keyId), updates);
    return { ...keyToUpdate, ...updates };
}

/**
 * Note: Key creation happens via the API route /api/keys
 * This ensures the key is hashed server-side and the full key
 * is only shown once to the user.
 */
