import { idbSave, idbLoad, idbRemove } from './db';

// Storage keys for localStorage and IndexedDB
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
    MEDIA: 'img_prompt_mgr_media',
    BACKUPS: 'img_prompt_mgr_backups',
} as const;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Get a collection (async, migrates from localStorage if needed)
 */
export async function getCollection<T>(key: string): Promise<T[]> {
    if (!isBrowser) return [];

    try {
        // 1. Try IndexedDB
        let data = await idbLoad<T[]>(key);

        // 2. Fallback to LocalStorage for migration
        if (!data) {
            const lsData = localStorage.getItem(key);
            if (lsData) {
                console.log(`Migrating ${key} from LocalStorage to IndexedDB...`);
                data = JSON.parse(lsData);
                if (data) {
                    await idbSave(key, data);
                    // We don't remove from LS yet to be extra safe during migration
                }
            }
        }

        return data || [];
    } catch (error) {
        console.error(`Error reading ${key} from IndexedDB, falling back to LocalStorage:`, error);
        // Fallback to LocalStorage on IDB failure
        const lsData = localStorage.getItem(key);
        if (lsData) {
            try {
                return JSON.parse(lsData) || [];
            } catch (pError) {
                console.error(`Error parsing LocalStorage data for ${key}:`, pError);
            }
        }
        return [];
    }
}

/**
 * Set a collection (async, saves to IndexedDB)
 */
export async function setCollection<T>(key: string, data: T[]): Promise<void> {
    if (!isBrowser) return;

    try {
        // Always try IndexedDB for all data
        await idbSave(key, data);

        // Mirror to LocalStorage for critical metadata (if not too large)
        // We avoid mirroring prompt_sets and shares as they might contain large image snapshots
        if (key !== STORAGE_KEYS.PROMPT_SETS && key !== STORAGE_KEYS.SHARES && key !== STORAGE_KEYS.GENERATION_CACHE) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (lsError) {
                console.warn(`LocalStorage write failed for ${key} (likely quota), but saved to IndexedDB.`, lsError);
            }
        }
    } catch (error) {
        console.error(`Error writing ${key} to IndexedDB:`, error);
        // Emergency fallback to LocalStorage if IDB fails
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (lsError) {
            console.error(`Critical: Both IDB and LocalStorage failed for ${key}`, lsError);
        }
    }
}

/**
 * Get a collection from sessionStorage (remains sync)
 */
export function getCollectionFromSession<T>(key: string): T[] {
    if (!isBrowser) return [];

    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`Error reading ${key} from sessionStorage:`, error);
        return [];
    }
}

/**
 * Set a collection in sessionStorage (remains sync)
 */
export function setCollectionInSession<T>(key: string, data: T[]): void {
    if (!isBrowser) return;

    try {
        sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            console.error(`SessionStorage quota exceeded while writing ${key}. Clearing session cache...`);
            sessionStorage.removeItem(key);
        } else {
            console.error(`Error writing ${key} to sessionStorage:`, error);
        }
    }
}

/**
 * Get a single item (async)
 */
export async function getItem<T>(key: string): Promise<T | null> {
    if (!isBrowser) return null;

    try {
        // Try IDB first
        let data = await idbLoad<T>(key);

        // Fallback to LS
        if (!data) {
            const lsData = localStorage.getItem(key);
            if (lsData) {
                data = JSON.parse(lsData);
                if (data) await idbSave(key, data);
            }
        }

        return data;
    } catch (error) {
        console.error(`Error reading ${key} from IndexedDB, falling back to LocalStorage:`, error);
        // Fallback to LocalStorage on IDB failure
        const lsData = localStorage.getItem(key);
        if (lsData) {
            try {
                return JSON.parse(lsData);
            } catch (pError) {
                console.error(`Error parsing LocalStorage data for ${key}:`, pError);
            }
        }
        return null;
    }
}

/**
 * Set a single item (async)
 */
export async function setItem<T>(key: string, data: T): Promise<void> {
    if (!isBrowser) return;

    try {
        // Always try IndexedDB
        await idbSave(key, data);

        // Mirror small items to LocalStorage
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (lsError) {
            // Silently ignore if it's just a mirror failure unless it's critical
            console.warn(`LocalStorage mirror failed for item ${key}`);
        }
    } catch (error) {
        console.error(`Error writing ${key} to IndexedDB:`, error);
        // Emergency fallback
        localStorage.setItem(key, JSON.stringify(data));
    }
}

/**
 * Remove an item from IndexedDB and LocalStorage
 */
export async function removeItem(key: string): Promise<void> {
    if (!isBrowser) return;

    try {
        await idbRemove(key);
    } catch (error) {
        console.error(`Error removing ${key} from IndexedDB:`, error);
    }

    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing ${key} from LocalStorage:`, error);
    }
}

/**
 * Remove an item from sessionStorage
 */
export function removeFromSession(key: string): void {
    if (!isBrowser) return;

    try {
        sessionStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing ${key} from sessionStorage:`, error);
    }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    if (isBrowser && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
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
