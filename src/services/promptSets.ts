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
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PromptSet, PromptVersion, Attachment } from '@/types';
import { getCurrentUser, isAdmin } from './auth';
import { addMediaImage } from './media';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'promptSets';

/**
 * Get all prompt sets (admin sees all, members see their own)
 */
export async function getPromptSets(userId?: string): Promise<PromptSet[]> {
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    let q;
    const colRef = collection(db, COLLECTION_NAME);

    if (userId) {
        // Filter by specific user
        q = query(colRef, where('userId', '==', userId), orderBy('updatedAt', 'desc'));
    } else if (adminMode) {
        // Admin sees everything
        q = query(colRef, orderBy('updatedAt', 'desc'));
    } else if (currentUser) {
        // Members see only their own
        q = query(colRef, where('userId', '==', currentUser.id), orderBy('updatedAt', 'desc'));
    } else {
        return [];
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as PromptSet);
}

/**
 * Get a single prompt set by ID
 */
export async function getPromptSetById(id: string): Promise<PromptSet | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const set = docSnap.data() as PromptSet;
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Permissions check
    if (adminMode || (currentUser && set.userId === currentUser.id)) {
        return set;
    }

    return null;
}

/**
 * Create a new prompt set
 */
export async function createPromptSet(data: {
    title: string;
    description?: string;
    categoryId?: string;
    notes?: string;
    initialPrompt?: string;
    initialAttachments?: Attachment[];
}): Promise<PromptSet | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const now = new Date().toISOString();
    const id = generateId();

    const versions: PromptVersion[] = data.initialPrompt
        ? [{
            id: generateId(),
            promptSetId: id,
            versionNumber: 1,
            promptText: data.initialPrompt,
            attachments: data.initialAttachments || [],
            createdAt: now,
            updatedAt: now,
        }]
        : [];

    const newSet: PromptSet = {
        id,
        userId: currentUser.id,
        title: data.title,
        description: data.description || '',
        categoryId: data.categoryId || '',
        notes: data.notes || '',
        versions,
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(newSet));
    return newSet;
}

/**
 * Update a prompt set
 */
export async function updatePromptSet(
    id: string,
    updates: Partial<Pick<PromptSet, 'title' | 'description' | 'categoryId' | 'notes'>>
): Promise<PromptSet | null> {
    const set = await getPromptSetById(id);
    if (!set) return null;

    const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString()
    };

    await updateDoc(doc(db, COLLECTION_NAME, id), sanitizeData(updatedData));
    return { ...set, ...updatedData } as PromptSet;
}

/**
 * Delete a prompt set
 */
export async function deletePromptSet(id: string): Promise<boolean> {
    const set = await getPromptSetById(id);
    if (!set) return false;

    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
}

/**
 * Add a new version to a prompt set
 */
export async function addVersion(
    promptSetId: string,
    promptText: string,
    notes?: string,
    attachments?: Attachment[]
): Promise<PromptVersion | null> {
    const set = await getPromptSetById(promptSetId);
    if (!set) return null;

    const now = new Date().toISOString();
    const maxVersionNumber = set.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0);

    const newVersion: PromptVersion = {
        id: generateId(),
        promptSetId,
        versionNumber: maxVersionNumber + 1,
        promptText,
        notes: notes || '',
        attachments: attachments || [],
        createdAt: now,
        updatedAt: now,
    };

    await updateDoc(doc(db, COLLECTION_NAME, promptSetId), sanitizeData({
        versions: [...set.versions, newVersion],
        updatedAt: now
    }));

    return newVersion;
}

/**
 * Update a version within a prompt set
 */
export async function updateVersion(
    promptSetId: string,
    versionId: string,
    updates: Partial<PromptVersion>
): Promise<PromptVersion | null> {
    const set = await getPromptSetById(promptSetId);
    if (!set) return null;

    const versionIndex = set.versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) return null;

    const now = new Date().toISOString();
    const updatedVersion = {
        ...set.versions[versionIndex],
        ...updates,
        updatedAt: now,
    };

    const updatedVersions = [...set.versions];
    updatedVersions[versionIndex] = updatedVersion;

    // If image added, sync to media
    if (updates.imageUrl) {
        await addMediaImage(updates.imageUrl, {
            promptSetId,
            versionId,
        });
    }

    await updateDoc(doc(db, COLLECTION_NAME, promptSetId), sanitizeData({
        versions: updatedVersions,
        updatedAt: now
    }));

    return updatedVersion;
}

/**
 * Delete a version
 */
export async function deleteVersion(promptSetId: string, versionId: string): Promise<boolean> {
    const set = await getPromptSetById(promptSetId);
    if (!set) return false;

    const filteredVersions = set.versions.filter(v => v.id !== versionId);

    await updateDoc(doc(db, COLLECTION_NAME, promptSetId), sanitizeData({
        versions: filteredVersions,
        updatedAt: new Date().toISOString()
    }));

    return true;
}

/**
 * Duplicate a prompt set
 */
export async function duplicatePromptSet(id: string, newOwnerId: string): Promise<PromptSet | null> {
    const originalSet = await getPromptSetById(id);
    if (!originalSet) return null;

    const now = new Date().toISOString();
    const newId = generateId();

    const newVersions: PromptVersion[] = originalSet.versions.map(v => ({
        ...v,
        id: generateId(),
        promptSetId: newId,
        createdAt: now,
        updatedAt: now,
    }));

    const duplicatedSet: PromptSet = {
        ...originalSet,
        id: newId,
        userId: newOwnerId,
        versions: newVersions,
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION_NAME, newId), sanitizeData(duplicatedSet));
    return duplicatedSet;
}

/**
 * Get by category
 */
export async function getPromptSetsByCategory(categoryId: string): Promise<PromptSet[]> {
    const sets = await getPromptSets();
    return sets.filter(s => s.categoryId === categoryId);
}
