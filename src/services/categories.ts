import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category } from '@/types';
import { getCurrentUser, isAdmin } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'categories';

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
 * Initialize categories
 */
export async function initializeCategories(): Promise<void> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('isSystem', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log('Initializing system categories in Firestore...');
        for (const cat of DEFAULT_CATEGORIES) {
            await setDoc(doc(db, COLLECTION_NAME, cat.id), sanitizeData(cat));
        }
    }
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<Category[]> {
    await initializeCategories();
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const allCategories = snapshot.docs.map(doc => doc.data() as Category);

    return allCategories.filter(c =>
        c.isSystem ||
        (currentUser && c.userId === currentUser.id) ||
        adminMode
    );
}

/**
 * Get system categories
 */
export async function getSystemCategories(): Promise<Category[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('isSystem', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Category);
}

/**
 * Get personal categories
 */
export async function getPersonalCategories(): Promise<Category[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('userId', '==', currentUser.id), where('isSystem', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Category);
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as Category : null;
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

    if (data.isSystem && !adminMode) return null;
    if (!data.isSystem && !currentUser) return null;

    const id = generateId();
    const newCategory: Category = {
        id,
        name: data.name,
        description: data.description || '',
        userId: data.isSystem ? null : currentUser!.id,
        isSystem: data.isSystem || false,
        createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(newCategory));
    return newCategory;
}

/**
 * Update a category
 */
export async function updateCategory(
    id: string,
    updates: Partial<Pick<Category, 'name' | 'description'>>
): Promise<Category | null> {
    const category = await getCategoryById(id);
    if (!category) return null;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    if (category.isSystem && !adminMode) return null;
    if (!category.isSystem && !adminMode && category.userId !== currentUser?.id) return null;

    await updateDoc(doc(db, COLLECTION_NAME, id), sanitizeData(updates));
    return { ...category, ...updates } as Category;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<boolean> {
    const category = await getCategoryById(id);
    if (!category) return false;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    if (category.isSystem && !adminMode) return false;
    if (!category.isSystem && !adminMode && category.userId !== currentUser?.id) return false;

    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
}
