// Storage keys for localStorage
export const STORAGE_KEYS = {
    USERS: 'img_prompt_mgr_users',
    CURRENT_USER: 'img_prompt_mgr_current_user',
    PROMPT_SETS: 'img_prompt_mgr_prompt_sets',
    CATEGORIES: 'img_prompt_mgr_categories',
    SHARES: 'img_prompt_mgr_shares',
    RATINGS: 'img_prompt_mgr_ratings',
    NOTIFICATIONS: 'img_prompt_mgr_notifications',
    GENERATION_CACHE: 'img_prompt_mgr_generation_cache',
    INVITE_LINKS: 'img_prompt_mgr_invite_links',
} as const;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Get a collection from localStorage
 */
export function getCollection<T>(key: string): T[] {
    if (!isBrowser) return [];

    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
        return [];
    }
}

/**
 * Set a collection in localStorage
 */
export function setCollection<T>(key: string, data: T[]): void {
    if (!isBrowser) return;

    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error writing ${key} to localStorage:`, error);
    }
}

/**
 * Get a single item from localStorage
 */
export function getItem<T>(key: string): T | null {
    if (!isBrowser) return null;

    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
        return null;
    }
}

/**
 * Set a single item in localStorage
 */
export function setItem<T>(key: string, data: T): void {
    if (!isBrowser) return;

    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error writing ${key} to localStorage:`, error);
    }
}

/**
 * Remove an item from localStorage
 */
export function removeItem(key: string): void {
    if (!isBrowser) return;

    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing ${key} from localStorage:`, error);
    }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (isBrowser && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Get current ISO timestamp
 */
export function getTimestamp(): string {
    return new Date().toISOString();
}
