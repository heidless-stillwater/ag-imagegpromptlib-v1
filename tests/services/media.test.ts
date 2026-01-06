
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addMediaImage, syncImagesFromVersions } from '@/services/media';

// Mock everything needed
vi.mock('@/lib/firebase', () => ({
    db: {},
}));

vi.mock('@/services/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'user1' }),
    isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/services/storage', () => ({
    generateId: () => 'mock-id',
}));

// Mock utils to have predictable ID generation for testing
vi.mock('@/lib/utils', () => ({
    generateDeterministicId: async (seed: string) => `hash-${seed}`,
}));

vi.mock('@/services/promptSets', () => ({
    getPromptSets: vi.fn().mockResolvedValue([
        {
            id: 'set1',
            userId: 'user1',
            versions: [
                { id: 'v1', imageUrl: 'http://test.com/img1.png', createdAt: '2023-01-01' }
            ]
        }
    ]),
}));

// Firestore Mocks
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockWriteBatch = vi.fn(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
    delete: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: (...args: any[]) => { mockDoc(...args); return 'ref'; },
    getDoc: (...args: any[]) => mockGetDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    writeBatch: () => mockWriteBatch(),
}));

describe('Media Service Duplicates Investigation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: Doc doesn't exist
        mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
    });

    it('addMediaImage should produce same ID for same URL', async () => {
        const url = 'http://example.com/image.png';
        const expectedId = 'hash-user1-' + url;

        // First add
        await addMediaImage(url);

        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'media', expectedId);
        expect(mockSetDoc).toHaveBeenCalledTimes(1);

        // Second add - Simulate doc exists
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ id: expectedId }) });
        mockSetDoc.mockClear();

        await addMediaImage(url);

        // Should verify it exists and return existing, NOT calling setDoc
        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'media', expectedId);
        expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('addMediaImage should produce NEW ID for slightly different URL', async () => {
        const url1 = 'http://example.com/image.png';
        const url2 = 'http://example.com/image.png '; // Trailing space/diff

        const id1 = 'hash-user1-' + url1;
        const id2 = 'hash-user1-' + url2;

        await addMediaImage(url1);
        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'media', id1);

        mockSetDoc.mockClear();
        // Simulate URL1 exists, but we are adding URL2
        mockGetDoc.mockImplementation((ref) => {
            // This is a comprehensive mock, but for this test simple logic suffices
            // We assume the service asks for ID2
            return { exists: () => false };
        });

        await addMediaImage(url2);

        expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'media', id2);
        expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('syncImagesFromVersions should not duplicate existing images', async () => {
        // Mock getDoc to return true (exists)
        mockGetDoc.mockResolvedValue({ exists: () => true });

        const result = await syncImagesFromVersions();

        expect(result.added).toBe(0);
        expect(mockBatchSet).not.toHaveBeenCalled();
    });

    it('syncImagesFromVersions should add non-existing images', async () => {
        // Mock getDoc to return false (does not exist)
        mockGetDoc.mockResolvedValue({ exists: () => false });

        const result = await syncImagesFromVersions();

        expect(result.added).toBe(1); // 1 version in mock
        expect(mockBatchSet).toHaveBeenCalledTimes(1);
    });
});
