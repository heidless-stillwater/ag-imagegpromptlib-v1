import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createShare,
    getIncomingShares,
    acceptShare,
} from '@/services/shares';
import { getCurrentUser, getUserById } from '@/services/auth';
import { getPromptSetById } from '@/services/promptSets';
import { mockFirestore, mockAuth } from '../setup';

// Mock high-level services to isolate logic
vi.mock('@/services/auth', () => ({
    getCurrentUser: vi.fn(),
    getUserById: vi.fn(),
    isAdmin: vi.fn(),
}));

vi.mock('@/services/promptSets', () => ({
    getPromptSetById: vi.fn(),
    createPromptSet: vi.fn(),
}));

describe('Shares Service', () => {
    const sender = { id: 'sender-1', email: 'sender@example.com', displayName: 'Sender' };
    const recipient = { id: 'recipient-1', email: 'recipient@example.com', displayName: 'Recipient' };

    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentUser as any).mockResolvedValue(sender);
    });

    describe('createShare', () => {
        it('should create a share offer', async () => {
            (getPromptSetById as any).mockResolvedValue({ id: 'set-1', userId: sender.id, title: 'Test' });
            (getUserById as any).mockResolvedValue(recipient);

            const result = await createShare('set-1', recipient.id);

            expect(result).not.toBeNull();
            expect(mockFirestore.setDoc).toHaveBeenCalled();
        });
    });

    describe('acceptShare', () => {
        it('should accept share', async () => {
            (getCurrentUser as any).mockResolvedValue(recipient);

            const mockShare = {
                id: 's1',
                recipientId: recipient.id,
                senderId: sender.id,
                state: 'inTransit',
                promptSetSnapshot: { title: 'Shared Set', versions: [] }
            };

            mockFirestore.getDoc.mockResolvedValueOnce(mockFirestore.createDocSnapshot(mockShare));

            const result = await acceptShare('s1');

            expect(result).not.toBeNull();
            expect(mockFirestore.updateDoc).toHaveBeenCalled();
            expect(mockFirestore.setDoc).toHaveBeenCalled();
        });
    });
});
