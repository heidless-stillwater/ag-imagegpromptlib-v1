import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getPromptSets,
    getPromptSetById,
    createPromptSet,
} from '@/services/promptSets';
import { getCurrentUser, isAdmin } from '@/services/auth';
import { mockFirestore } from '../setup';

vi.mock('@/services/auth', () => ({
    getCurrentUser: vi.fn(),
    getUserById: vi.fn(),
    isAdmin: vi.fn(),
}));

describe('PromptSets Service', () => {
    const testUser = { id: 'user-1', email: 'test@example.com', role: 'member' };

    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentUser as any).mockResolvedValue(testUser);
        (isAdmin as any).mockResolvedValue(false);
    });

    describe('createPromptSet', () => {
        it('should create a prompt set for logged-in user', async () => {
            const data = { title: 'Test Prompt Set', description: 'desc' };
            const result = await createPromptSet(data);

            expect(result).not.toBeNull();
            expect(result?.title).toBe('Test Prompt Set');
            expect(mockFirestore.setDoc).toHaveBeenCalled();
        });

        it('should return null when not logged in', async () => {
            (getCurrentUser as any).mockResolvedValue(null);
            const result = await createPromptSet({ title: 'Test' });
            expect(result).toBeNull();
        });
    });

    describe('getPromptSets', () => {
        it('should fetch prompt sets for the current user', async () => {
            const mockSets = [{ id: '1', title: 'Set 1', userId: testUser.id }];
            mockFirestore.getDocs.mockResolvedValueOnce(mockFirestore.createCollectionSnapshot(mockSets));

            const result = await getPromptSets();
            expect(result).toHaveLength(1);
        });
    });

    describe('getPromptSetById', () => {
        it('should return prompt set', async () => {
            const mockSet = { id: '1', title: 'Test', userId: testUser.id };
            mockFirestore.getDoc.mockResolvedValueOnce(mockFirestore.createDocSnapshot(mockSet));

            const result = await getPromptSetById('1');
            expect(result?.title).toBe('Test');
        });
    });
});
