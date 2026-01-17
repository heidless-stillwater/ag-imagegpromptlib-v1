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
 * Cleanup function to migrate from localStorage/sessionStorage to IndexedDB
 */
function cleanupOldCache() {
    if (typeof window !== 'undefined') {
        const oldLSCache = localStorage.getItem(STORAGE_KEYS.GENERATION_CACHE);
        if (oldLSCache) {
            console.log('Cleaning up legacy localStorage generation cache...');
            localStorage.removeItem(STORAGE_KEYS.GENERATION_CACHE);
        }

        const oldSessionCache = sessionStorage.getItem(STORAGE_KEYS.GENERATION_CACHE);
        if (oldSessionCache) {
            console.log('Cleaning up legacy sessionStorage generation cache...');
            sessionStorage.removeItem(STORAGE_KEYS.GENERATION_CACHE);
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
    const cache = await getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);
    const entry = cache.find(c => c.promptHash === hash);

    return entry?.imageUrl || null;
}

/**
 * Maximum number of images to keep in the cache
 * Increased since we now use IndexedDB which has a much higher quota.
 */
const MAX_CACHE_SIZE = 5;

/**
 * Add an image to the cache
 */
export async function addToCache(prompt: string, imageUrl: string): Promise<void> {
    const hash = await hashPrompt(prompt);
    const cache = await getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

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

    await setCollection(STORAGE_KEYS.GENERATION_CACHE, updatedCache);
}

/**
 * Clear the generation cache
 */
export async function clearCache(): Promise<void> {
    await setCollection(STORAGE_KEYS.GENERATION_CACHE, []);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestEntry?: string }> {
    const cache = await getCollection<GenerationCache>(STORAGE_KEYS.GENERATION_CACHE);

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
    videoUrl?: string; // Support for video results
    error?: string;
    fromCache?: boolean;
}

export interface ImageInput {
    data: string;      // Base64 data (without data URL prefix)
    mimeType: string;  // e.g., 'image/png', 'image/jpeg'
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
    bypassCache: boolean = false,
    apiKey?: string,
    images?: ImageInput[],
    backgroundStyle?: string,
    aspectRatio?: string
): Promise<GenerationResult> {
    // For 'live' mode, first check cache (only if no images - multimodal requests are unique)
    if (mode === 'live' && !bypassCache && (!images || images.length === 0)) {
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
                testConnection: mode === 'test',
                apiKey,
                images,
                backgroundStyle,
                aspectRatio,
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

/**
 * Helper to wait for a specified duration
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate a video using Veo 3
 * @param prompt The video prompt
 * @param apiKey Optional user API key
 * @param onProgress Optional callback for generation progress (0-100)
 */
export async function generateVideo(
    prompt: string,
    apiKey?: string,
    aspectRatio?: string,
    onProgress?: (progress: number) => void
): Promise<GenerationResult> {
    try {
        // 1. Initial request to start generation
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                type: 'video', // Specify video generation
                apiKey,
                aspectRatio,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to start video generation',
            };
        }

        if (!data.operationName) {
            return {
                success: false,
                error: 'No operation name returned for video generation',
            };
        }

        const operationName = data.operationName;
        console.log('Video generation started. Operation:', operationName);

        // 2. Polling loop
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes max
        const pollInterval = 10000; // 10 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            await delay(pollInterval);

            console.log(`Polling video status... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);

            const statusRes = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'video-status',
                    operationName,
                    apiKey,
                }),
            });

            const statusData = await statusRes.json();

            if (!statusRes.ok) {
                console.error('Polling error:', statusData.error);
                // We keep polling in case it's a transient error
                continue;
            }

            if (statusData.done) {
                // Set progress to 100 when done
                if (onProgress) onProgress(100);

                if (statusData.videoUrl) {
                    return {
                        success: true,
                        videoUrl: statusData.videoUrl,
                        fromCache: false,
                    };
                } else if (statusData.error) {
                    return {
                        success: false,
                        error: statusData.error,
                    };
                } else {
                    return {
                        success: false,
                        error: 'Video generation finished with no result.',
                    };
                }
            }

            // Still processing...
            if (onProgress && typeof statusData.progress === 'number') {
                onProgress(statusData.progress);
            }
            console.log(`Still processing: ${statusData.progress || 0}%`);
        }

        return {
            success: false,
            error: 'Video generation timed out after 5 minutes.',
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}
