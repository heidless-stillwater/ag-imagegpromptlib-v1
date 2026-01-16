import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AspectRatioSelector from '../../src/components/common/AspectRatioSelector';
import { getAspectRatios } from '../../src/services/aspectRatios';

// Mock the services
vi.mock('../../src/services/aspectRatios', () => ({
    getAspectRatios: vi.fn(),
}));

const mockRatios = [
    {
        id: 'ratio-1',
        name: 'Widescreen',
        value: '16:9',
        isDefault: true,
        isSystem: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'ratio-2',
        name: 'Square',
        value: '1:1',
        isDefault: false,
        isSystem: true,
        createdAt: new Date().toISOString()
    }
];

describe('AspectRatioSelector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getAspectRatios as any).mockResolvedValue(mockRatios);
    });

    it('renders and loads aspect ratios', async () => {
        const onSelect = vi.fn();
        render(<AspectRatioSelector onSelect={onSelect} />);

        // Check for label
        expect(screen.getByText('Select Aspect Ratio')).toBeInTheDocument();

        // Wait for ratios to load
        await waitFor(() => {
            expect(screen.getByText('Widescreen')).toBeInTheDocument();
            expect(screen.getByText('Square')).toBeInTheDocument();
        });

        // Ensure default ratio was automatically selected on mount if no selectedId was provided
        expect(onSelect).toHaveBeenCalledWith(mockRatios[0]);
    });

    it('highlights the selected ratio', async () => {
        const onSelect = vi.fn();
        const { rerender } = render(<AspectRatioSelector selectedId="ratio-2" onSelect={onSelect} />);

        await waitFor(() => {
            expect(screen.getByText('Square')).toBeInTheDocument();
        });

        // The Square ratio card should have the 'selected' class (checking by container class)
        // Note: We need to find the parent container. In the component, it's a div with ratioCard class.
        const squareCard = screen.getByText('Square').closest('div[class*="ratioCard"]');
        expect(squareCard?.className).toContain('selected');

        const widescreenCard = screen.getByText('Widescreen').closest('div[class*="ratioCard"]');
        expect(widescreenCard?.className).not.toContain('selected');
    });

    it('calls onSelect when a ratio is clicked', async () => {
        const onSelect = vi.fn();
        render(<AspectRatioSelector onSelect={onSelect} />);

        await waitFor(() => {
            expect(screen.getByText('Square')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Square'));
        expect(onSelect).toHaveBeenCalledWith(mockRatios[1]);
    });
});
