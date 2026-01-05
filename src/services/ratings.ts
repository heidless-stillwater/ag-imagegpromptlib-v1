import { Rating } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser } from './auth';

/**
 * Rate a prompt set (1-5 stars)
 */
export function ratePromptSet(promptSetId: string, score: number): Rating | null {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    // Validate score
    if (score < 1 || score > 5 || !Number.isInteger(score)) {
        return null;
    }

    const ratings = getCollection<Rating>(STORAGE_KEYS.RATINGS);
    const existingIndex = ratings.findIndex(
        r => r.promptSetId === promptSetId && r.userId === currentUser.id
    );

    const now = getTimestamp();

    if (existingIndex !== -1) {
        // Update existing rating
        const updatedRating: Rating = {
            ...ratings[existingIndex],
            score,
            createdAt: now,
        };
        ratings[existingIndex] = updatedRating;
        setCollection(STORAGE_KEYS.RATINGS, ratings);
        return updatedRating;
    }

    // Create new rating
    const newRating: Rating = {
        id: generateId(),
        promptSetId,
        userId: currentUser.id,
        score,
        createdAt: now,
    };

    setCollection(STORAGE_KEYS.RATINGS, [...ratings, newRating]);
    return newRating;
}

/**
 * Get user's rating for a prompt set
 */
export function getUserRating(promptSetId: string): Rating | null {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const ratings = getCollection<Rating>(STORAGE_KEYS.RATINGS);
    return ratings.find(
        r => r.promptSetId === promptSetId && r.userId === currentUser.id
    ) || null;
}

/**
 * Get average rating for a prompt set
 */
export function getAverageRating(promptSetId: string): { average: number; count: number } {
    const ratings = getCollection<Rating>(STORAGE_KEYS.RATINGS);
    const promptRatings = ratings.filter(r => r.promptSetId === promptSetId);

    if (promptRatings.length === 0) {
        return { average: 0, count: 0 };
    }

    const sum = promptRatings.reduce((acc, r) => acc + r.score, 0);
    const average = sum / promptRatings.length;

    return {
        average: Math.round(average * 10) / 10, // Round to 1 decimal
        count: promptRatings.length,
    };
}

/**
 * Get all ratings for a prompt set
 */
export function getRatingsForPromptSet(promptSetId: string): Rating[] {
    const ratings = getCollection<Rating>(STORAGE_KEYS.RATINGS);
    return ratings.filter(r => r.promptSetId === promptSetId);
}

/**
 * Remove a rating
 */
export function removeRating(promptSetId: string): boolean {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    const ratings = getCollection<Rating>(STORAGE_KEYS.RATINGS);
    const filtered = ratings.filter(
        r => !(r.promptSetId === promptSetId && r.userId === currentUser.id)
    );

    if (filtered.length === ratings.length) {
        return false; // Nothing was removed
    }

    setCollection(STORAGE_KEYS.RATINGS, filtered);
    return true;
}
