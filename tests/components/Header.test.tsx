import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Header from '@/components/layout/Header';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

// Mock the Auth Context
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        useAuth: vi.fn(),
    };
});

// Mock Notifications hook
vi.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({ unreadCount: 0 }),
}));

describe('Header Component Mobile Logic', () => {
    const mockUser = {
        displayName: 'Test User',
        role: 'member',
        email: 'test@example.com',
    };

    const mockAuthValues = {
        user: mockUser,
        isAdmin: false,
        isLoading: false,
        logout: vi.fn(),
        switchRole: vi.fn(),
    };

    beforeEach(() => {
        (useAuth as any).mockReturnValue(mockAuthValues);
    });

    it('renders the hamburger menu toggle on mobile', () => {
        render(<Header />);
        const toggleButton = screen.getByLabelText(/toggle menu/i);
        expect(toggleButton).toBeInTheDocument();
    });

    it('opens the mobile menu when the hamburger icon is clicked', () => {
        render(<Header />);
        const toggleButton = screen.getByLabelText(/toggle menu/i);

        // Initial state: menu is closed
        expect(screen.queryByText(/dashboard/i)).not.toHaveClass('mobileOpen');

        // Click to open
        fireEvent.click(toggleButton);

        // Check if the nav has the mobileOpen class
        const nav = screen.getByRole('navigation');
        expect(nav).toHaveClass(/mobileOpen/);
    });

    it('closes the mobile menu when a nav link is clicked', () => {
        render(<Header />);
        const toggleButton = screen.getByLabelText(/toggle menu/i);

        // Open menu
        fireEvent.click(toggleButton);

        // Click a link
        const dashboardLink = screen.getByText(/dashboard/i);
        fireEvent.click(dashboardLink);

        // Check if the nav no longer has the mobileOpen class
        const nav = screen.getByRole('navigation');
        expect(nav).not.toHaveClass(/mobileOpen/);
    });

    it('closes the mobile menu when the backdrop is clicked', () => {
        render(<Header />);
        const toggleButton = screen.getByLabelText(/toggle menu/i);

        // Open menu
        fireEvent.click(toggleButton);

        // Click backdrop
        const backdrop = screen.getByTestId('menu-backdrop');
        fireEvent.click(backdrop);

        // Check if the nav no longer has the mobileOpen class
        const nav = screen.getByRole('navigation');
        expect(nav).not.toHaveClass(/mobileOpen/);
    });
});
