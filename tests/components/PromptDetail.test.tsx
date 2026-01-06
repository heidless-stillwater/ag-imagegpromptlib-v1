import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import PromptDetailPage from '../../src/app/(dashboard)/prompts/[id]/page';
import { useAuth } from '../../src/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';

// Mocks
vi.mock('next/navigation', () => ({
    useParams: vi.fn(),
    useRouter: vi.fn(),
}));

vi.mock('../../src/contexts/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Mock services to avoid network calls
vi.mock('../../src/services/promptSets', () => ({
    getPromptSetById: vi.fn().mockResolvedValue({
        id: 'test-prompt-id',
        title: 'Test Prompt',
        description: 'Test Description',
        categoryId: 'cat-1',
        versions: [
            {
                id: 'v1',
                versionNumber: 1,
                promptText: 'A beautiful sunset over the ocean',
                createdAt: new Date().toISOString(),
            }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user-1',
        isPublic: false,
    }),
    getCategories: vi.fn().mockResolvedValue([]),
    addVersion: vi.fn(),
    updateVersion: vi.fn(),
    deleteVersion: vi.fn(),
}));

vi.mock('../../src/services/categories', () => ({
    getCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/ratings', () => ({
    getAverageRating: vi.fn().mockResolvedValue({ average: 0, count: 0 }),
    getUserRating: vi.fn().mockResolvedValue({ score: 0 }),
    ratePromptSet: vi.fn(),
}));

describe('PromptDetailPage', () => {
    it('renders the version list', async () => {
        // Setup mocks
        (useParams as any).mockReturnValue({ id: 'test-prompt-id' });
        (useRouter as any).mockReturnValue({ push: vi.fn() });
        (useAuth as any).mockReturnValue({ user: { uid: 'user-1' }, isAdmin: false });

        render(<PromptDetailPage />);

        // Check if loading state initially appears (optional, but good practice)
        // Check if title renders after data load
        expect(await screen.findByText('Test Prompt')).toBeInTheDocument();

        // Check for version list item
        expect(screen.getByText('v1')).toBeInTheDocument();
        // The prompt text appears in both the list and the detail view
        const promptTexts = screen.getAllByText(/A beautiful sunset/);
        expect(promptTexts.length).toBeGreaterThan(0);

        // Check for Versions header
        expect(screen.getByText('Versions')).toBeInTheDocument();
    });
});
