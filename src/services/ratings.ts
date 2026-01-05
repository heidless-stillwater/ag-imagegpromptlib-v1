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
import { Rating } from '@/types';
import { getCurrentUser } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'ratings';

/**
 * Rate a prompt set
 */
export async function ratePromptSet(promptSetId: string, score: number): Promise<Rating | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    if (score < 1 || score > 5 || !Number.isInteger(score)) return null;

    // Check existing
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('promptSetId', '==', promptSetId), where('userId', '==', currentUser.id));
    const snapshot = await getDocs(q);

    const now = new Date().toISOString();
    let rating: Rating;

    if (!snapshot.empty) {
        rating = snapshot.docs[0].data() as Rating;
        rating.score = score;
        rating.createdAt = now; // Update timestamp
        await updateDoc(doc(db, COLLECTION_NAME, rating.id), { score, createdAt: now });
    } else {
        const id = generateId();
        rating = {
            id,
            promptSetId,
            userId: currentUser.id,
            score,
            createdAt: now,
        };
        await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(rating));
    }

    return rating;
}

/**
 * Get user's rating
 */
export async function getUserRating(promptSetId: string): Promise<Rating | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('promptSetId', '==', promptSetId), where('userId', '==', currentUser.id));
    const snapshot = await getDocs(q);

    return snapshot.empty ? null : snapshot.docs[0].data() as Rating;
}

/**
 * Get average rating
 */
export async function getAverageRating(promptSetId: string): Promise<{ average: number; count: number }> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('promptSetId', '==', promptSetId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return { average: 0, count: 0 };

    const promptRatings = snapshot.docs.map(doc => doc.data() as Rating);
    const sum = promptRatings.reduce((acc, r) => acc + r.score, 0);
    const average = sum / promptRatings.length;

    return {
        average: Math.round(average * 10) / 10,
        count: promptRatings.length,
    };
}

/**
 * Get all ratings
 */
export async function getRatingsForPromptSet(promptSetId: string): Promise<Rating[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('promptSetId', '==', promptSetId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Rating);
}

/**
 * Remove rating
 */
export async function removeRating(promptSetId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('promptSetId', '==', promptSetId), where('userId', '==', currentUser.id));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return false;

    await deleteDoc(doc(db, COLLECTION_NAME, snapshot.docs[0].id));
    return true;
}
