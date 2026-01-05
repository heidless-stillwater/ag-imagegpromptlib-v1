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
export async function initializeCategories(): Promise<void> {
    const existingCategories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const hasSystemCategories = existingCategories.some(c => c.isSystem);

    if (!hasSystemCategories) {
        await setCollection(STORAGE_KEYS.CATEGORIES, [...DEFAULT_CATEGORIES, ...existingCategories]);
    }
}

/**
 * Get all categories visible to current user
 */
export async function getCategories(): Promise<Category[]> {
    await initializeCategories();
    const allCategories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Return system categories + user's personal categories
    return allCategories.filter(c =>
        c.isSystem ||
        (currentUser && c.userId === currentUser.id) ||
        adminMode
    );
}

/**
 * Get system categories only
 */
export async function getSystemCategories(): Promise<Category[]> {
    await initializeCategories();
    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return categories.filter(c => c.isSystem);
}

/**
 * Get personal categories for current user
 */
export async function getPersonalCategories(): Promise<Category[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return categories.filter(
        c => !c.isSystem && c.userId === currentUser.id
    );
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
    await initializeCategories();
    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return categories.find(c => c.id === id) || null;
}

/**
 * Create a new category
 */
export async function createCategory(data: {
    name: string;
    description?: string;
    isSystem?: boolean;
}): Promise<Category | null> {
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Only admin can create system categories
    if (data.isSystem && !adminMode) {
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

    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    await setCollection(STORAGE_KEYS.CATEGORIES, [...categories, newCategory]);

    return newCategory;
}

/**
 * Update a category
 */
export async function updateCategory(
    id: string,
    updates: Partial<Pick<Category, 'name' | 'description'>>
): Promise<Category | null> {
    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const categoryIndex = categories.findIndex(c => c.id === id);

    if (categoryIndex === -1) return null;

    const category = categories[categoryIndex];
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission: admin can update any, user can update their own
    if (category.isSystem && !adminMode) {
        return null;
    }
    if (!category.isSystem && !adminMode && category.userId !== currentUser?.id) {
        return null;
    }

    const updatedCategory: Category = {
        ...category,
        ...updates,
    };

    categories[categoryIndex] = updatedCategory;
    await setCollection(STORAGE_KEYS.CATEGORIES, categories);

    return updatedCategory;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<boolean> {
    const categories = await getCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const category = categories.find(c => c.id === id);

    if (!category) return false;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    // Check permission
    if (category.isSystem && !adminMode) {
        return false;
    }
    if (!category.isSystem && !adminMode && category.userId !== currentUser?.id) {
        return false;
    }

    const filteredCategories = categories.filter(c => c.id !== id);
    await setCollection(STORAGE_KEYS.CATEGORIES, filteredCategories);

    return true;
}
