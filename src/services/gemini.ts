import { GenerationCache } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    getCollectionFromSession,
    setCollectionInSession,
    removeItem,
    getTimestamp
} from './storage';

/**
 * Cleanup function to migrate from localStorage to sessionStorage
 * and remove the old large data if it exists.
 */
function cleanupOldCache() {
    if (typeof window !== 'undefined') {
        const oldCache = localStorage.getItem(STORAGE_KEYS.GENERATION_CACHE);
        if (oldCache) {
            console.log('Migrating generation cache to sessionStorage and cleaning up localStorage...');
            localStorage.removeItem(STORAGE_KEYS.GENERATION_CACHE);
        }
    }
}

// Run cleanup once on module load
cleanupOldCache();

/**
 * Generate a hash for a prompt string (for caching)
 */
export async function hashPrompt(prompt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt.trim().toLowerCase());

    if (typeof window !== 'undefined' && window.crypto?.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback for environments without crypto.subtle
    let hash = 0;
    const str = prompt.trim().toLowerCase();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Check if we have a cached image for this prompt
 */
export async function checkCache(prompt: string): Promise<string | null> {
    const hash = await hashPrompt(prompt);
    // sessionStorage methods remain synchronous because they fit within the 5MB limit
    // and are extremely fast, and they don't have a Promise-based API in the browser.
    const cache = getCollectionFromSession<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);
    const entry = cache.find(c => c.promptHash === hash);

    return entry?.imageUrl || null;
}

/**
 * Maximum number of images to keep in the session cache
 */
const MAX_CACHE_SIZE = 2;

/**
 * Add an image to the cache
 */
export async function addToCache(prompt: string, imageUrl: string): Promise<void> {
    const hash = await hashPrompt(prompt);
    const cache = getCollectionFromSession<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

    // Remove existing entry if present
    let filtered = cache.filter(c => c.promptHash !== hash);

    const newEntry: GenerationCache = {
        promptHash: hash,
        imageUrl,
        generatedAt: getTimestamp(),
    };

    // Add new entry and keep only the MAX_CACHE_SIZE most recent ones
    const updatedCache = [...filtered, newEntry]
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, MAX_CACHE_SIZE);

    setCollectionInSession(STORAGE_KEYS.GENERATION_CACHE, updatedCache);
}

/**
 * Clear the generation cache
 */
export async function clearCache(): Promise<void> {
    setCollectionInSession(STORAGE_KEYS.GENERATION_CACHE, []);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestEntry?: string }> {
    const cache = getCollectionFromSession<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

    if (cache.length === 0) {
        return { count: 0 };
    }

    const oldest = cache.reduce((min, entry) =>
        new Date(entry.generatedAt) < new Date(min.generatedAt) ? entry : min
    );

    return {
        count: cache.length,
        oldestEntry: oldest.generatedAt,
    };
}

/* ============================================
   IMAGE GENERATION - REQUIRES USER PERMISSION
   ============================================

   IMPORTANT: The generateImage function below will make
   actual API calls to the Gemini API. Before calling this
   function, you MUST:
   
   1. Show the user the exact prompt that will be sent
   2. Get explicit confirmation to proceed
   3. Display a warning about API usage
   
   The UI should implement a confirmation modal that requires
   the user to click a "Generate" button before this function
   is called.
   ============================================ */

export interface GenerationResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
    fromCache?: boolean;
}

export type GenerationMode = 'unsplash' | 'test' | 'live';

/**
 * Generate an image using different modes
 * @param prompt The image prompt
 * @param mode The generation mode: 'unsplash' (placeholder), 'test' (connectivity), 'live' (actual generation)
 */
export async function generateImage(
    prompt: string,
    mode: GenerationMode = 'live',
    bypassCache: boolean = false
): Promise<GenerationResult> {
    // For 'live' mode, first check cache
    if (mode === 'live' && !bypassCache) {
        const cachedImage = await checkCache(prompt);
        if (cachedImage) {
            return {
                success: true,
                imageUrl: cachedImage,
                fromCache: true,
            };
        }
    }

    // Handle 'unsplash' mode - generate a placeholder
    if (mode === 'unsplash') {
        const keywords = prompt.split(' ').slice(0, 5).join(',');
        const imageUrl = `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800&q=${encodeURIComponent(keywords)}`;
        // Note: Using a fixed high-quality abstract image as base, but could use source.unsplash.com if it were still reliable
        // For dynamic placeholders, we'll use a curated high-quality one
        return {
            success: true,
            imageUrl: `https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&q=80&w=800&q=${encodeURIComponent(keywords)}`,
            fromCache: false,
        };
    }

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                testConnection: mode === 'test'
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to generate image',
            };
        }

        if (mode === 'test') {
            return {
                success: true,
                fromCache: false,
            };
        }

        if (data.imageUrl) {
            // Cache the result
            await addToCache(prompt, data.imageUrl);

            return {
                success: true,
                imageUrl: data.imageUrl,
                fromCache: false,
            };
        }

        return {
            success: false,
            error: 'No image returned from API',
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
