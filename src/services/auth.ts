import { User } from '@/types';
import {
    STORAGE_KEYS,
    getItem,
    setItem,
    removeItem,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';

// Default mock users for testing
const DEFAULT_USERS: User[] = [
    {
        id: 'admin-001',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        isPublic: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'member-001',
        email: 'member@example.com',
        displayName: 'Test Member',
        role: 'member',
        isPublic: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'member-002',
        email: 'jane@example.com',
        displayName: 'Jane Developer',
        role: 'member',
        isPublic: true,
        createdAt: '2024-01-02T00:00:00.000Z',
    },
    {
        id: 'member-003',
        email: 'bob@example.com',
        displayName: 'Bob Artist',
        role: 'member',
        isPublic: false,
        createdAt: '2024-01-03T00:00:00.000Z',
    },
];

/**
 * Initialize users if not already present
 */
export function initializeUsers(): void {
    const existingUsers = getCollection<User>(STORAGE_KEYS.USERS);
    if (existingUsers.length === 0) {
        setCollection(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }
}

/**
 * Get all users
 */
export function getAllUsers(): User[] {
    initializeUsers();
    return getCollection<User>(STORAGE_KEYS.USERS);
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
    const users = getAllUsers();
    return users.find(u => u.id === id) || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
    const users = getAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get current logged-in user
 */
export function getCurrentUser(): User | null {
    return getItem<User>(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Login as a user (mock authentication)
 */
export function login(email: string): User | null {
    initializeUsers();
    const user = getUserByEmail(email);

    if (user) {
        setItem(STORAGE_KEYS.CURRENT_USER, user);
        return user;
    }

    return null;
}

/**
 * Login with a specific role (for testing)
 */
export function loginWithRole(role: 'admin' | 'member'): User {
    initializeUsers();
    const users = getAllUsers();
    const user = users.find(u => u.role === role);

    if (user) {
        setItem(STORAGE_KEYS.CURRENT_USER, user);
        return user;
    }

    // Fallback: create a new user with the role
    const newUser: User = {
        id: generateId(),
        email: `${role}@example.com`,
        displayName: `Test ${role}`,
        role,
        isPublic: true,
        createdAt: getTimestamp(),
    };

    const updatedUsers = [...users, newUser];
    setCollection(STORAGE_KEYS.USERS, updatedUsers);
    setItem(STORAGE_KEYS.CURRENT_USER, newUser);

    return newUser;
}

/**
 * Logout current user
 */
export function logout(): void {
    removeItem(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Switch current user's role (for testing)
 */
export function switchRole(newRole: 'admin' | 'member'): User | null {
    const currentUser = getCurrentUser();

    if (!currentUser) {
        return loginWithRole(newRole);
    }

    const updatedUser: User = {
        ...currentUser,
        role: newRole,
    };

    // Update in users collection
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);

    if (userIndex !== -1) {
        users[userIndex] = updatedUser;
        setCollection(STORAGE_KEYS.USERS, users);
    }

    setItem(STORAGE_KEYS.CURRENT_USER, updatedUser);

    return updatedUser;
}

/**
 * Register a new user
 */
export function registerUser(email: string, displayName: string, role: 'admin' | 'member' = 'member'): User | null {
    const existingUser = getUserByEmail(email);

    if (existingUser) {
        return null; // User already exists
    }

    const newUser: User = {
        id: generateId(),
        email,
        displayName,
        role,
        isPublic: true,
        createdAt: getTimestamp(),
    };

    const users = getAllUsers();
    setCollection(STORAGE_KEYS.USERS, [...users, newUser]);

    return newUser;
}

/**
 * Update user profile
 */
export function updateUserProfile(userId: string, updates: Partial<Pick<User, 'displayName' | 'isPublic'>>): User | null {
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return null;
    }

    const updatedUser: User = {
        ...users[userIndex],
        ...updates,
    };

    users[userIndex] = updatedUser;
    setCollection(STORAGE_KEYS.USERS, users);

    // Update current user if this is the logged-in user
    const currentUser = getCurrentUser();
    if (currentUser?.id === userId) {
        setItem(STORAGE_KEYS.CURRENT_USER, updatedUser);
    }

    return updatedUser;
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
    const user = getCurrentUser();
    return user?.role === 'admin';
}
