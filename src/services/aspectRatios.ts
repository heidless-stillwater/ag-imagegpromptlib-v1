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
        id: 'ratio-square',
        name: 'Square',
        value: '1:1',
        primaryUseCase: 'Profile pictures, Instagram, Social Media post',
        visualFeel: 'Balanced, centered, stable',
        isDefault: true,
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ratio-landscape-4-3',
        name: 'Classic Landscape',
        value: '4:3',
        primaryUseCase: 'Traditional television, photography, monitors',
        visualFeel: 'Timeless, natural, established',
        isDefault: false,
        userId: null,
        isSystem: true,
        createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
        id: 'ratio-landscape-16-9',
        name: 'Wide Landscape',
        value: '16:9',
        primaryUseCase: 'Cinematic shots, modern screens, YouTube, presentations',
        visualFeel: 'Expansive, modern, immersive',
        isDefault: false,
        userId: null,
        isSystem: true,
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
        createdAt: '2024-01-01T00:00:00.000Z',
    }
];

/**
 * Initialize aspect ratios
 */
export async function initializeAspectRatios(): Promise<void> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('isSystem', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log('Initializing system aspect ratios in Firestore...');
        for (const ratio of DEFAULT_RATIOS) {
            await setDoc(doc(db, COLLECTION_NAME, ratio.id), sanitizeData(ratio));
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
    const allRatios = snapshot.docs.map(doc => doc.data() as AspectRatio);

    return allRatios.filter(r =>
        r.isSystem ||
        (currentUser && r.userId === currentUser.id) ||
        adminMode
    );
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
    const adminMode = await isAdmin();

    if (data.isSystem && !adminMode) return null;
    if (!data.isSystem && !currentUser) return null;

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
    const adminMode = await isAdmin();

    if (ratio.isSystem && !adminMode) return null;
    if (!ratio.isSystem && !adminMode && ratio.userId !== currentUser?.id) return null;

    await updateDoc(doc(db, COLLECTION_NAME, id), sanitizeData(updates));
    return { ...ratio, ...updates } as AspectRatio;
}

/**
 * Delete an aspect ratio
 */
export async function deleteAspectRatio(id: string): Promise<boolean> {
    const ratio = await getAspectRatioById(id);
    if (!ratio) return false;

    const currentUser = await getCurrentUser();
    const adminMode = await isAdmin();

    if (ratio.isSystem && !adminMode) return false;
    if (!ratio.isSystem && !adminMode && ratio.userId !== currentUser?.id) return false;

    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
}
