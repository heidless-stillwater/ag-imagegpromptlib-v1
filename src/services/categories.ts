import { Category } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser, isAdmin } from './auth';

// Default system categories
const DEFAULT_CATEGORIES: Category[] = [
    {
        id: 'cat-landscape',
        name: 'Landscapes',
        description: 'Nature and scenic views',
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'cat-portrait',
        name: 'Portraits',
        description: 'People and character images',
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'cat-abstract',
        name: 'Abstract',
        description: 'Abstract and artistic compositions',
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'cat-scifi',
        name: 'Sci-Fi',
        description: 'Science fiction and futuristic themes',
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'cat-fantasy',
        name: 'Fantasy',
        description: 'Fantasy and magical themes',
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
];

/**
 * Initialize categories if not present
 */
export function initializeCategories(): void {
    const existingCategories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const hasSystemCategories = existingCategories.some(c => c.isSystem);

    if (!hasSystemCategories) {
        setCollection(STORAGE_KEYS.CATEGORIES, [...DEFAULT_CATEGORIES, ...existingCategories]);
    }
}

/**
 * Get all categories visible to current user
 */
export function getCategories(): Category[] {
    initializeCategories();
    const allCategories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const currentUser = getCurrentUser();

    // Return system categories + user's personal categories
    return allCategories.filter(c =>
        c.isSystem ||
        (currentUser && c.userId === currentUser.id) ||
        isAdmin()
    );
}

/**
 * Get system categories only
 */
export function getSystemCategories(): Category[] {
    initializeCategories();
    return getCollection<Category>(STORAGE_KEYS.CATEGORIES).filter(c => c.isSystem);
}

/**
 * Get personal categories for current user
 */
export function getPersonalCategories(): Category[] {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    return getCollection<Category>(STORAGE_KEYS.CATEGORIES).filter(
        c => !c.isSystem && c.userId === currentUser.id
    );
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): Category | null {
    initializeCategories();
    const categories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return categories.find(c => c.id === id) || null;
}

/**
 * Create a new category
 */
export function createCategory(data: {
    name: string;
    description?: string;
    isSystem?: boolean;
}): Category | null {
    const currentUser = getCurrentUser();

    // Only admin can create system categories
    if (data.isSystem && !isAdmin()) {
        return null;
    }

    // Must be logged in to create personal category
    if (!data.isSystem && !currentUser) {
        return null;
    }

    const newCategory: Category = {
        id: generateId(),
        name: data.name,
        description: data.description,
        userId: data.isSystem ? null : currentUser!.id,
        isSystem: data.isSystem || false,
        createdAt: getTimestamp(),
    };

    const categories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    setCollection(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);

    return newCategory;
}

/**
 * Update a category
 */
export function updateCategory(
    id: string,
    updates: Partial<Pick<Category, 'name' | 'description'>>
): Category | null {
    const categories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const categoryIndex = categories.findIndex(c => c.id === id);

    if (categoryIndex === -1) return null;

    const category = categories[categoryIndex];
    const currentUser = getCurrentUser();

    // Check permission: admin can update any, user can update their own
    if (category.isSystem && !isAdmin()) {
        return null;
    }
    if (!category.isSystem && !isAdmin() && category.userId !== currentUser?.id) {
        return null;
    }

    const updatedCategory: Category = {
        ...category,
        ...updates,
    };

    categories[categoryIndex] = updatedCategory;
    setCollection(STORAGE_KEYS.CATEGORIES, categories);

    return updatedCategory;
}

/**
 * Delete a category
 */
export function deleteCategory(id: string): boolean {
    const categories = getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const category = categories.find(c => c.id === id);

    if (!category) return false;

    const currentUser = getCurrentUser();

    // Check permission
    if (category.isSystem && !isAdmin()) {
        return false;
    }
    if (!category.isSystem && !isAdmin() && category.userId !== currentUser?.id) {
        return false;
    }

    const filteredCategories = categories.filter(c => c.id !== id);
    setCollection(STORAGE_KEYS.CATEGORIES, filteredCategories);

    return true;
}
