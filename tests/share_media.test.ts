import { describe, it, expect, beforeEach, vi } from 'vitest';
import { acceptShare } from '../src/services/shares';
import * as firestore from 'firebase/firestore';
import * as auth from '../src/services/auth';
import * as media from '../src/services/media';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    db: {}
}));

vi.mock('../src/services/auth', () => ({
    getCurrentUser: vi.fn(),
    getUserById: vi.fn(),
    isAdmin: vi.fn(() => Promise.resolve(false))
}));

vi.mock('../src/services/media', () => ({
    addMediaImage: vi.fn()
}));

vi.mock('../src/services/upload', () => ({
    duplicateStorageFile: vi.fn((url) => Promise.resolve(`${url}_copy`))
}));

vi.mock('../src/services/notifications', () => ({
    createNotification: vi.fn()
}));

describe('Accept Share - Media Population', () => {
    const mockUser = { id: 'member1', displayName: 'Member' };
    const mockShare = {
        id: 'share1',
        recipientId: 'member1',
        senderId: 'admin1',
        state: 'inTransit',
        promptSetSnapshot: {
            id: 'set1',
            title: 'Shared Set',
            versions: [
                { id: 'v1', imageUrl: 'https://example.com/img1.png' },
                { id: 'v2', imageUrl: 'https://example.com/img2.png' }
            ]
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (auth.getCurrentUser as any).mockResolvedValue(mockUser);
    });

    it('should create copies of images and add THEM to media library when share is accepted', async () => {
        // Mock getShareById (via getDoc)
        (firestore.getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => mockShare
        });

        const result = await acceptShare('share1');

        expect(result).not.toBeNull();

        // Verify duplicateStorageFile was called for each image
        const upload = await import('../src/services/upload');
        expect(upload.duplicateStorageFile).toHaveBeenCalledTimes(2);

        // Verify addMediaImage was called for each NEW image URL
        expect(media.addMediaImage).toHaveBeenCalledTimes(2);
        expect(media.addMediaImage).toHaveBeenCalledWith('https://example.com/img1.png_copy', expect.objectContaining({
            promptSetId: expect.any(String),
            versionId: expect.any(String)
        }));
        expect(media.addMediaImage).toHaveBeenCalledWith('https://example.com/img2.png_copy', expect.objectContaining({
            promptSetId: expect.any(String),
            versionId: expect.any(String)
        }));

        // Verify result has the new URLs
        expect(result?.versions[0].imageUrl).toBe('https://example.com/img1.png_copy');
        expect(result?.versions[1].imageUrl).toBe('https://example.com/img2.png_copy');

        // Final verify that setDoc and updateDoc were called
        expect(firestore.setDoc).toHaveBeenCalled();
        expect(firestore.updateDoc).toHaveBeenCalled();
    });
});
