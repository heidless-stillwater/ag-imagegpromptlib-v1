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
import { AspectRatio } from '@/types';
import { getCurrentUser, isAdmin } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'aspectRatios';

const DEFAULT_RATIOS: AspectRatio[] = [
    {
        id: 'ratio-widescreen-16-9',
        name: 'Widescreen',
        value: '16:9',
        primaryUseCase: 'YouTube, TV, Monitors',
        visualFeel: 'Modern, standard',
        isDefault: true,
        userId: null,
        isSystem: true,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ratio-standard-4-3',
        name: 'Standard',
        value: '4:3',
        primaryUseCase: 'Classic TV, smartphones',
        visualFeel: 'Natural, documentary',
        isDefault: false,
        userId: null,
        isSystem: true,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ratio-square',
        name: 'Square',
        value: '1:1',
        primaryUseCase: 'Profile pictures, Instagram, Social Media post',
        visualFeel: 'Balanced, centered, stable',
        isDefault: false,
        userId: null,
        isSystem: true,
        order: 2,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ratio-portrait-9-16',
        name: 'Story Portrait',
        value: '9:16',
        primaryUseCase: 'Mobile fullscreen, TikTok, Instagram Stories, Reels',
        visualFeel: 'Vertical, modern, focused',
        isDefault: false,
        userId: null,
        isSystem: true,
        order: 3,
        createdAt: '2024-01-01T00:00:00.000Z',
    }
];

/**
 * Initialize aspect ratios
 */
export async function initializeAspectRatios(): Promise<void> {
    console.log('Checking system aspect ratios in Firestore...');
    for (const ratio of DEFAULT_RATIOS) {
        const docRef = doc(db, COLLECTION_NAME, ratio.id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.log(`Initializing missing aspect ratio: ${ratio.name}`);
            await setDoc(docRef, sanitizeData(ratio));
        }
    }
}

/**
 * Get all aspect ratios
 */
export async function getAspectRatios(): Promise<AspectRatio[]> {
    await initializeAspectRatios();
    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    let allRatios = snapshot.docs.map(doc => doc.data() as AspectRatio);

    // Filter by visibility
    allRatios = allRatios.filter(r =>
        r.isSystem ||
        (currentUser && r.userId === currentUser.id) ||
        adminMode
    );

    // Apply ordering
    if (currentUser?.settings?.aspectRatioOrder && currentUser.settings.aspectRatioOrder.length > 0) {
        const customOrder = currentUser.settings.aspectRatioOrder;
        allRatios.sort((a, b) => {
            const indexA = customOrder.indexOf(a.id);
            const indexB = customOrder.indexOf(b.id);

            // If both in custom order, use that
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only one in custom order, it goes first
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // Otherwise fallback to default order or createdAt
            return (a.order ?? 999) - (b.order ?? 999) || a.createdAt.localeCompare(b.createdAt);
        });
    } else {
        // Fallback to default system order
        allRatios.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.createdAt.localeCompare(b.createdAt));
    }

    return allRatios;
}

/**
 * Get aspect ratio by ID
 */
export async function getAspectRatioById(id: string): Promise<AspectRatio | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as AspectRatio : null;
}

/**
 * Create a new aspect ratio
 */
export async function createAspectRatio(data: {
    name: string;
    value: string;
    primaryUseCase?: string;
    visualFeel?: string;
    isDefault?: boolean;
    isSystem?: boolean;
}): Promise<AspectRatio | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const id = generateId();
    const newRatio: AspectRatio = {
        id,
        name: data.name,
        value: data.value,
        primaryUseCase: data.primaryUseCase || '',
        visualFeel: data.visualFeel || '',
        isDefault: data.isDefault || false,
        userId: data.isSystem ? null : currentUser!.id,
        isSystem: data.isSystem || false,
        createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(newRatio));
    return newRatio;
}

/**
 * Update an aspect ratio
 */
export async function updateAspectRatio(
    id: string,
    updates: Partial<Omit<AspectRatio, 'id' | 'userId' | 'isSystem' | 'createdAt'>>
): Promise<AspectRatio | null> {
    const ratio = await getAspectRatioById(id);
    if (!ratio) return null;

    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const sanitizedUpdates = sanitizeData(updates);
    await updateDoc(doc(db, COLLECTION_NAME, id), sanitizedUpdates);
    return { ...ratio, ...updates } as AspectRatio;
}

/**
 * Delete an aspect ratio
 */
export async function deleteAspectRatio(id: string): Promise<boolean> {
    const ratio = await getAspectRatioById(id);
    if (!ratio) return false;

    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
}
