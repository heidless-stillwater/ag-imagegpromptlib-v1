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
export function getPromptSets(userId?: string): PromptSet[] {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const currentUser = getCurrentUser();

    // If specific userId provided, filter by that
    if (userId) {
        return allSets.filter(set => set.userId === userId);
    }

    // Admin sees all
    if (isAdmin()) {
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
export function getPromptSetById(id: string): PromptSet | null {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const set = allSets.find(s => s.id === id);

    if (!set) return null;

    const currentUser = getCurrentUser();

    // Admin can access any
    if (isAdmin()) return set;

    // Member can only access their own
    if (currentUser && set.userId === currentUser.id) return set;

    return null;
}

/**
 * Create a new prompt set
 */
export function createPromptSet(data: {
    title: string;
    description?: string;
    categoryId?: string;
    notes?: string;
    initialPrompt?: string;
}): PromptSet | null {
    const currentUser = getCurrentUser();

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

    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    setCollection(STORAGE_KEYS.PROMPT_SETS, [...allSets, newSet]);

    return newSet;
}

/**
 * Update a prompt set
 */
export function updatePromptSet(
    id: string,
    updates: Partial<Pick<PromptSet, 'title' | 'description' | 'categoryId' | 'notes'>>
): PromptSet | null {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === id);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = getCurrentUser();

    // Check permission
    if (!isAdmin() && currentUser?.id !== set.userId) {
        return null;
    }

    const updatedSet: PromptSet = {
        ...set,
        ...updates,
        updatedAt: getTimestamp(),
    };

    allSets[setIndex] = updatedSet;
    setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return updatedSet;
}

/**
 * Delete a prompt set
 */
export function deletePromptSet(id: string): boolean {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const set = allSets.find(s => s.id === id);

    if (!set) return false;

    const currentUser = getCurrentUser();

    // Check permission
    if (!isAdmin() && currentUser?.id !== set.userId) {
        return false;
    }

    const filteredSets = allSets.filter(s => s.id !== id);
    setCollection(STORAGE_KEYS.PROMPT_SETS, filteredSets);

    return true;
}

/**
 * Add a new version to a prompt set
 */
export function addVersion(promptSetId: string, promptText: string, notes?: string): PromptVersion | null {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = getCurrentUser();

    // Check permission
    if (!isAdmin() && currentUser?.id !== set.userId) {
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

    setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return newVersion;
}

/**
 * Update a version
 */
export function updateVersion(
    promptSetId: string,
    versionId: string,
    updates: Partial<Pick<PromptVersion, 'promptText' | 'notes' | 'imageUrl' | 'imageGeneratedAt'>>
): PromptVersion | null {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return null;

    const set = allSets[setIndex];
    const currentUser = getCurrentUser();

    // Check permission
    if (!isAdmin() && currentUser?.id !== set.userId) {
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

    setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return updatedVersion;
}

/**
 * Delete a version
 */
export function deleteVersion(promptSetId: string, versionId: string): boolean {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const setIndex = allSets.findIndex(s => s.id === promptSetId);

    if (setIndex === -1) return false;

    const set = allSets[setIndex];
    const currentUser = getCurrentUser();

    // Check permission
    if (!isAdmin() && currentUser?.id !== set.userId) {
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

    setCollection(STORAGE_KEYS.PROMPT_SETS, allSets);

    return true;
}

/**
 * Duplicate a prompt set (used for sharing)
 */
export function duplicatePromptSet(id: string, newOwnerId: string): PromptSet | null {
    const allSets = getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
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

    setCollection(STORAGE_KEYS.PROMPT_SETS, [...allSets, duplicatedSet]);

    return duplicatedSet;
}

/**
 * Get prompt sets by category
 */
export function getPromptSetsByCategory(categoryId: string): PromptSet[] {
    const sets = getPromptSets();
    return sets.filter(s => s.categoryId === categoryId);
}
