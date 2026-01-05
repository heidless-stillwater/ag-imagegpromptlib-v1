import { PromptSet, PromptVersion } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser, isAdmin } from './auth';

/**
 * Get all prompt sets (admin sees all, members see their own)
 */
export async function getPromptSets(userId?: string): Promise<PromptSet[]> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // If specific userId provided, filter by that
    if (userId) {
        return allSets.filter(set => set.userId === userId);
    }

    // Admin sees all
    if (adminMode) {
        return allSets;
    }

    // Members see only their own
    if (currentUser) {
        return allSets.filter(set => set.userId === currentUser.id);
    }

    return [];
}

/**
 * Get a single prompt set by ID
 */
export async function getPromptSetById(id: string): Promise<PromptSet | null> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const set = allSets.find(s => s.id === id);

    if (!set) return null;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Admin can access any
    if (adminMode) return set;

    // Member can only access their own
    if (currentUser && set.userId === currentUser.id) return set;

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
}): Promise<PromptSet | null> {
    const currentUser = await getCurrentUser();

    if (!currentUser) return null;

    const now = getTimestamp();
    const promptSetId = generateId();

    // Create initial version if prompt provided
    const versions: PromptVersion[] = data.initialPrompt
        ? [{
            id: generateId(),
            promptSetId,
            versionNumber: 1,
            promptText: data.initialPrompt,
            createdAt: now,
            updatedAt: now,
        }]
        : [];

    const newSet: PromptSet = {
        id: promptSetId,
        userId: currentUser.id,
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        notes: data.notes,
        versions,
        createdAt: now,
        updatedAt: now,
    };

    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    await setCollection(STORAGE_KEYS.PROMPT_SETS, [...allSets, newSet]);

    return newSet;
}

/**
 * Update a prompt set
 */
export async function updatePromptSet(
    id: string,
    updates: Partial<Pick<PromptSet, 'title' | 'description' | 'categoryId' | 'notes'>>
): Promise<PromptSet | null> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === id);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (!adminMode && currentUser?.id !== set.userId) {
        return null;
    }

    const updatedSet: PromptSet = {
        ...set,
        ...updates,
        updatedAt: getTimestamp(),
    };

    allSets[setIndex] = updatedSet;
    await setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return updatedSet;
}

/**
 * Delete a prompt set
 */
export async function deletePromptSet(id: string): Promise<boolean> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const set = allSets.find(s => s.id === id);

    if (!set) return false;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (!adminMode && currentUser?.id !== set.userId) {
        return false;
    }

    const filteredSets = allSets.filter(s => s.id !== id);
    await setCollection(STORAGE_KEYS.PROMPT_SETS, filteredSets);

    return true;
}

/**
 * Add a new version to a prompt set
 */
export async function addVersion(promptSetId: string, promptText: string, notes?: string): Promise<PromptVersion | null> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (!adminMode && currentUser?.id !== set.userId) {
        return null;
    }

    const now = getTimestamp();
    const maxVersionNumber = set.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0);

    const newVersion: PromptVersion = {
        id: generateId(),
        promptSetId,
        versionNumber: maxVersionNumber + 1,
        promptText,
        notes,
        createdAt: now,
        updatedAt: now,
    };

    allSets[setIndex] = {
        ...set,
        versions: [...set.versions, newVersion],
        updatedAt: now,
    };

    await setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return newVersion;
}

/**
 * Update a version
 */
export async function updateVersion(
    promptSetId: string,
    versionId: string,
    updates: Partial<Pick<PromptVersion, 'promptText' | 'notes' | 'imageUrl' | 'imageGeneratedAt'>>
): Promise<PromptVersion | null> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (!adminMode && currentUser?.id !== set.userId) {
        return null;
    }

    const versionIndex = set.versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) return null;

    const now = getTimestamp();
    const updatedVersion: PromptVersion = {
        ...set.versions[versionIndex],
        ...updates,
        updatedAt: now,
    };

    const updatedVersions = [...set.versions];
    updatedVersions[versionIndex] = updatedVersion;

    allSets[setIndex] = {
        ...set,
        versions: updatedVersions,
        updatedAt: now,
    };

    await setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return updatedVersion;
}

/**
 * Delete a version
 */
export async function deleteVersion(promptSetId: string, versionId: string): Promise<boolean> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return false;

    const set = allSets[setIndex];
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (!adminMode && currentUser?.id !== set.userId) {
        return false;
    }

    // Check if version exists
    const versionExists = set.versions.some(v => v.id === versionId);
    if (!versionExists) return false;

    const filteredVersions = set.versions.filter(v => v.id !== versionId);

    allSets[setIndex] = {
        ...set,
        versions: filteredVersions,
        updatedAt: getTimestamp(),
    };

    await setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return true;
}

/**
 * Duplicate a prompt set (used for sharing)
 */
export async function duplicatePromptSet(id: string, newOwnerId: string): Promise<PromptSet | null> {
    const allSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const originalSet = allSets.find(s => s.id === id);

    if (!originalSet) return null;

    const now = getTimestamp();
    const newSetId = generateId();

    // Deep copy versions with new IDs
    const newVersions: PromptVersion[] = originalSet.versions.map(v => ({
        ...v,
        id: generateId(),
        promptSetId: newSetId,
        createdAt: now,
        updatedAt: now,
    }));

    const duplicatedSet: PromptSet = {
        ...originalSet,
        id: newSetId,
        userId: newOwnerId,
        versions: newVersions,
        createdAt: now,
        updatedAt: now,
    };

    await setCollection(STORAGE_KEYS.PROMPT_SETS, [...allSets, duplicatedSet]);

    return duplicatedSet;
}

/**
 * Get prompt sets by category
 */
export async function getPromptSetsByCategory(categoryId: string): Promise<PromptSet[]> {
    const sets = await getPromptSets();
    return sets.filter(s => s.categoryId === categoryId);
}
