import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getPromptSets,
    getPromptSetById,
    createPromptSet,
    updatePromptSet,
    deletePromptSet,
    addVersion,
    updateVersion,
    deleteVersion,
    duplicatePromptSet,
    getPromptSetsByCategory,
} from '@/services/promptSets';
import { login, logout } from '@/services/auth';
import { STORAGE_KEYS } from '@/services/storage';
import { PromptSet, User } from '@/types';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', {
    value: {
        localStorage: localStorageMock,
        crypto: { randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}` }
    },
    writable: true
});

// Test data
const testUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'member',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

const adminUser: User = {
    id: 'admin-1',
    email: 'admin@example.com',
    displayName: 'Admin User',
    role: 'admin',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

const otherUser: User = {
    id: 'user-2',
    email: 'other@example.com',
    displayName: 'Other User',
    role: 'member',
    isPublic: true,
    createdAt: new Date().toISOString(),
};

describe('PromptSets Service', () => {
    beforeEach(() => {
        localStorageMock.clear();
        // Set up users in storage
        localStorageMock.setItem(STORAGE_KEYS.USERS, JSON.stringify([testUser, adminUser, otherUser]));
    });

    describe('createPromptSet', () => {
        it('should create a prompt set for logged-in user', () => {
            login(testUser.email);

            const promptSet = createPromptSet({
                title: 'Test Prompt Set',
                description: 'A test description',
            });

            expect(promptSet).not.toBeNull();
            expect(promptSet?.title).toBe('Test Prompt Set');
            expect(promptSet?.description).toBe('A test description');
            expect(promptSet?.userId).toBe(testUser.id);
            expect(promptSet?.versions).toHaveLength(0);
        });

        it('should create prompt set with initial version if provided', () => {
            login(testUser.email);

            const promptSet = createPromptSet({
                title: 'Test Prompt Set',
                initialPrompt: 'A beautiful sunset over mountains',
            });

            expect(promptSet?.versions).toHaveLength(1);
            expect(promptSet?.versions[0].promptText).toBe('A beautiful sunset over mountains');
            expect(promptSet?.versions[0].versionNumber).toBe(1);
        });

        it('should return null when not logged in', () => {
            logout();

            const promptSet = createPromptSet({
                title: 'Test Prompt Set',
            });

            expect(promptSet).toBeNull();
        });
    });

    describe('getPromptSets', () => {
        beforeEach(() => {
            // Create some prompt sets
            login(testUser.email);
            createPromptSet({ title: 'User 1 Set 1' });
            createPromptSet({ title: 'User 1 Set 2' });
            logout();

            login(otherUser.email);
            createPromptSet({ title: 'User 2 Set 1' });
            logout();
        });

        it('should return only own prompt sets for member', () => {
            login(testUser.email);

            const sets = getPromptSets();

            expect(sets).toHaveLength(2);
            expect(sets.every(s => s.userId === testUser.id)).toBe(true);
        });

        it('should return all prompt sets for admin', () => {
            login(adminUser.email);

            const sets = getPromptSets();

            expect(sets).toHaveLength(3);
        });

        it('should filter by userId when specified', () => {
            login(adminUser.email);

            const sets = getPromptSets(otherUser.id);

            expect(sets).toHaveLength(1);
            expect(sets[0].title).toBe('User 2 Set 1');
        });

        it('should return empty array when not logged in', () => {
            logout();

            const sets = getPromptSets();

            expect(sets).toHaveLength(0);
        });
    });

    describe('getPromptSetById', () => {
        let createdSet: PromptSet | null;

        beforeEach(() => {
            login(testUser.email);
            createdSet = createPromptSet({ title: 'Test Set' });
        });

        it('should return prompt set for owner', () => {
            const set = getPromptSetById(createdSet!.id);

            expect(set).not.toBeNull();
            expect(set?.id).toBe(createdSet!.id);
        });

        it('should return null for non-owner member', () => {
            logout();
            login(otherUser.email);

            const set = getPromptSetById(createdSet!.id);

            expect(set).toBeNull();
        });

        it('should return prompt set for admin regardless of owner', () => {
            logout();
            login(adminUser.email);

            const set = getPromptSetById(createdSet!.id);

            expect(set).not.toBeNull();
            expect(set?.id).toBe(createdSet!.id);
        });

        it('should return null for non-existent ID', () => {
            const set = getPromptSetById('non-existent-id');

            expect(set).toBeNull();
        });
    });

    describe('updatePromptSet', () => {
        let createdSet: PromptSet | null;

        beforeEach(() => {
            login(testUser.email);
            createdSet = createPromptSet({ title: 'Original Title' });
        });

        it('should update prompt set for owner', () => {
            const updated = updatePromptSet(createdSet!.id, {
                title: 'Updated Title',
                description: 'New description',
            });

            expect(updated).not.toBeNull();
            expect(updated?.title).toBe('Updated Title');
            expect(updated?.description).toBe('New description');
        });

        it('should not update for non-owner member', () => {
            logout();
            login(otherUser.email);

            const updated = updatePromptSet(createdSet!.id, { title: 'Hacked!' });

            expect(updated).toBeNull();
        });

        it('should update for admin regardless of owner', () => {
            logout();
            login(adminUser.email);

            const updated = updatePromptSet(createdSet!.id, { title: 'Admin Updated' });

            expect(updated).not.toBeNull();
            expect(updated?.title).toBe('Admin Updated');
        });
    });

    describe('deletePromptSet', () => {
        let createdSet: PromptSet | null;

        beforeEach(() => {
            login(testUser.email);
            createdSet = createPromptSet({ title: 'To Be Deleted' });
        });

        it('should delete prompt set for owner', () => {
            const deleted = deletePromptSet(createdSet!.id);

            expect(deleted).toBe(true);
            expect(getPromptSetById(createdSet!.id)).toBeNull();
        });

        it('should not delete for non-owner member', () => {
            logout();
            login(otherUser.email);

            const deleted = deletePromptSet(createdSet!.id);

            expect(deleted).toBe(false);
        });

        it('should delete for admin regardless of owner', () => {
            logout();
            login(adminUser.email);

            const deleted = deletePromptSet(createdSet!.id);

            expect(deleted).toBe(true);
        });
    });

    describe('Version Management', () => {
        let createdSet: PromptSet | null;

        beforeEach(() => {
            login(testUser.email);
            createdSet = createPromptSet({ title: 'Test Set' });
        });

        describe('addVersion', () => {
            it('should add a new version with correct version number', () => {
                const version1 = addVersion(createdSet!.id, 'First prompt');
                const version2 = addVersion(createdSet!.id, 'Second prompt');

                expect(version1?.versionNumber).toBe(1);
                expect(version2?.versionNumber).toBe(2);
            });

            it('should add version with notes', () => {
                const version = addVersion(createdSet!.id, 'My prompt', 'Testing notes');

                expect(version?.notes).toBe('Testing notes');
            });

            it('should return null for non-owner', () => {
                logout();
                login(otherUser.email);

                const version = addVersion(createdSet!.id, 'Unauthorized');

                expect(version).toBeNull();
            });
        });

        describe('updateVersion', () => {
            it('should update version prompt text', () => {
                const version = addVersion(createdSet!.id, 'Original prompt');

                const updated = updateVersion(createdSet!.id, version!.id, {
                    promptText: 'Updated prompt',
                });

                expect(updated?.promptText).toBe('Updated prompt');
            });

            it('should update version with image data', () => {
                const version = addVersion(createdSet!.id, 'My prompt');

                const updated = updateVersion(createdSet!.id, version!.id, {
                    imageUrl: 'data:image/png;base64,abc123',
                    imageGeneratedAt: new Date().toISOString(),
                });

                expect(updated?.imageUrl).toBe('data:image/png;base64,abc123');
                expect(updated?.imageGeneratedAt).toBeDefined();
            });
        });

        describe('deleteVersion', () => {
            it('should delete a version', () => {
                const version = addVersion(createdSet!.id, 'To delete');

                const deleted = deleteVersion(createdSet!.id, version!.id);

                expect(deleted).toBe(true);

                const set = getPromptSetById(createdSet!.id);
                expect(set?.versions.find(v => v.id === version!.id)).toBeUndefined();
            });

            it('should return false for non-existent version', () => {
                const deleted = deleteVersion(createdSet!.id, 'fake-version-id');

                expect(deleted).toBe(false);
            });
        });
    });

    describe('duplicatePromptSet', () => {
        let createdSet: PromptSet | null;
        let originalVersionIds: string[] = [];

        beforeEach(() => {
            login(testUser.email, 'member');
            createdSet = createPromptSet({
                title: 'Original Set',
                description: 'Original description',
            });
            const v1 = addVersion(createdSet!.id, 'Version 1 prompt');
            const v2 = addVersion(createdSet!.id, 'Version 2 prompt');
            originalVersionIds = [v1!.id, v2!.id];
            // Refetch to get updated set with versions
            createdSet = getPromptSetById(createdSet!.id);
        });

        it('should create a copy with new owner', () => {
            const duplicate = duplicatePromptSet(createdSet!.id, otherUser.id);

            expect(duplicate).not.toBeNull();
            expect(duplicate?.userId).toBe(otherUser.id);
            expect(duplicate?.title).toBe('Original Set');
            expect(duplicate?.id).not.toBe(createdSet!.id);
        });

        it('should deep copy all versions', () => {
            const duplicate = duplicatePromptSet(createdSet!.id, otherUser.id);

            expect(duplicate?.versions).toHaveLength(2);
            expect(duplicate?.versions[0].promptSetId).toBe(duplicate?.id);
            // Verify versions have new IDs (not same as originals)
            expect(originalVersionIds).not.toContain(duplicate?.versions[0].id);
            expect(originalVersionIds).not.toContain(duplicate?.versions[1].id);
        });
    });

    describe('getPromptSetsByCategory', () => {
        beforeEach(() => {
            login(testUser.email);
            createPromptSet({ title: 'Set 1', categoryId: 'cat-1' });
            createPromptSet({ title: 'Set 2', categoryId: 'cat-1' });
            createPromptSet({ title: 'Set 3', categoryId: 'cat-2' });
        });

        it('should filter by category', () => {
            const sets = getPromptSetsByCategory('cat-1');

            expect(sets).toHaveLength(2);
            expect(sets.every(s => s.categoryId === 'cat-1')).toBe(true);
        });

        it('should return empty array for non-existent category', () => {
            const sets = getPromptSetsByCategory('non-existent');

            expect(sets).toHaveLength(0);
        });
    });
});
