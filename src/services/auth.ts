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
export async function initializeUsers(): Promise<void> {
    const existingUsers = await getCollection<User>(STORAGE_KEYS.USERS);
    if (existingUsers.length === 0) {
        await setCollection(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
    await initializeUsers();
    return await getCollection<User>(STORAGE_KEYS.USERS);
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
    const users = await getAllUsers();
    return users.find(u => u.id === id) || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    const users = await getAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get current logged-in user
 */
export async function getCurrentUser(): Promise<User | null> {
    return await getItem<User>(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Login as a user (mock authentication)
 */
export async function login(email: string): Promise<User | null> {
    await initializeUsers();
    const user = await getUserByEmail(email);

    if (user) {
        await setItem(STORAGE_KEYS.CURRENT_USER, user);
        return user;
    }

    return null;
}

/**
 * Login with a specific role (for testing)
 */
export async function loginWithRole(role: 'admin' | 'member'): Promise<User> {
    await initializeUsers();
    const users = await getAllUsers();
    const user = users.find(u => u.role === role);

    if (user) {
        await setItem(STORAGE_KEYS.CURRENT_USER, user);
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
    await setCollection(STORAGE_KEYS.USERS, updatedUsers);
    await setItem(STORAGE_KEYS.CURRENT_USER, newUser);

    return newUser;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
    await removeItem(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Switch current user's role (for testing)
 */
export async function switchRole(newRole: 'admin' | 'member'): Promise<User | null> {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
        return await loginWithRole(newRole);
    }

    const updatedUser: User = {
        ...currentUser,
        role: newRole,
    };

    // Update in users collection
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);

    if (userIndex !== -1) {
        users[userIndex] = updatedUser;
        await setCollection(STORAGE_KEYS.USERS, users);
    }

    await setItem(STORAGE_KEYS.CURRENT_USER, updatedUser);

    return updatedUser;
}

/**
 * Register a new user
 */
export async function registerUser(email: string, displayName: string, role: 'admin' | 'member' = 'member'): Promise<User | null> {
    const existingUser = await getUserByEmail(email);

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

    const users = await getAllUsers();
    await setCollection(STORAGE_KEYS.USERS, [...users, newUser]);

    return newUser;
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, updates: Partial<Pick<User, 'displayName' | 'isPublic'>>): Promise<User | null> {
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return null;
    }

    const updatedUser: User = {
        ...users[userIndex],
        ...updates,
    };

    users[userIndex] = updatedUser;
    await setCollection(STORAGE_KEYS.USERS, users);

    // Update current user if this is the logged-in user
    const currentUser = await getCurrentUser();
    if (currentUser?.id === userId) {
        await setItem(STORAGE_KEYS.CURRENT_USER, updatedUser);
    }

    return updatedUser;
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.role === 'admin';
}
