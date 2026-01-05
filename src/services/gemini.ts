import { GenerationCache } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    getTimestamp
} from './storage';

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
    const cache = getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);
    const entry = cache.find(c => c.promptHash === hash);

    return entry?.imageUrl || null;
}

/**
 * Add an image to the cache
 */
export async function addToCache(prompt: string, imageUrl: string): Promise<void> {
    const hash = await hashPrompt(prompt);
    const cache = getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

    // Remove existing entry if present
    const filtered = cache.filter(c => c.promptHash !== hash);

    const newEntry: GenerationCache = {
        promptHash: hash,
        imageUrl,
        generatedAt: getTimestamp(),
    };

    setCollection(STORAGE_KEYS.GENERATION_CACHE, [...filtered, newEntry]);
}

/**
 * Clear the generation cache
 */
export function clearCache(): void {
    setCollection(STORAGE_KEYS.GENERATION_CACHE, []);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; oldestEntry?: string } {
    const cache = getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

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

/**
 * Generate an image using the server-side API route
 * NOTE: This makes an actual API call - ensure user has confirmed!
 */
export async function generateImage(prompt: string): Promise<GenerationResult> {
    // First check cache
    const cachedImage = await checkCache(prompt);
    if (cachedImage) {
        return {
            success: true,
            imageUrl: cachedImage,
            fromCache: true,
        };
    }

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to generate image',
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
