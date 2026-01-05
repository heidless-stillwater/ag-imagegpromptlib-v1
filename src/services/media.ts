import { MediaImage, PromptSet } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getCurrentUser, isAdmin } from './auth';

/**
 * Get all media images for current user
 * Admin sees all images
 */
export async function getMediaImages(): Promise<MediaImage[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const allMedia = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);
    const adminMode = await isAdmin();

    if (adminMode) return allMedia;

    return allMedia.filter(img => img.userId === currentUser.id);
}

/**
 * Add a new image to the media library
 */
export async function addMediaImage(
    url: string,
    metadata?: { promptSetId?: string; versionId?: string }
): Promise<MediaImage | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const media = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);

    // Skip if image with same URL already exists for this user
    const exists = media.find(img => img.url === url && img.userId === currentUser.id);
    if (exists) return exists;

    const newImage: MediaImage = {
        id: generateId(),
        userId: currentUser.id,
        url,
        promptSetId: metadata?.promptSetId,
        versionId: metadata?.versionId,
        createdAt: getTimestamp(),
    };

    await setCollection(STORAGE_KEYS.MEDIA, [...media, newImage]);
    return newImage;
}

/**
 * Delete an image from the media library
 */
export async function deleteMediaImage(id: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const media = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);
    const image = media.find(img => img.id === id);

    if (!image) return false;

    // Check permission: admin or owner
    const adminMode = await isAdmin();
    if (!adminMode && image.userId !== currentUser.id) {
        return false;
    }

    const filtered = media.filter(img => img.id !== id);
    await setCollection(STORAGE_KEYS.MEDIA, filtered);
    return true;
}

/**
 * Sync all images from prompt set versions into the media library
 */
export async function syncImagesFromVersions(): Promise<{ added: number }> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { added: 0 };

    const promptSets = await getCollection<PromptSet>(STORAGE_KEYS.PROMPT_SETS);
    const media = await getCollection<MediaImage>(STORAGE_KEYS.MEDIA);

    // Admin syncs for everyone, member syncs for themselves
    const adminMode = await isAdmin();
    const userSets = adminMode ? promptSets : promptSets.filter(s => s.userId === currentUser.id);

    let addedCount = 0;
    const newMedia = [...media];

    for (const set of userSets) {
        for (const version of set.versions) {
            if (version.imageUrl) {
                // Check if this specific URL for this user already exists in media
                const exists = newMedia.some(img =>
                    img.url === version.imageUrl &&
                    img.userId === set.userId
                );

                if (!exists) {
                    newMedia.push({
                        id: generateId(),
                        userId: set.userId,
                        url: version.imageUrl,
                        promptSetId: set.id,
                        versionId: version.id,
                        createdAt: version.imageGeneratedAt || getTimestamp(),
                    });
                    addedCount++;
                }
            }
        }
    }

    if (addedCount > 0) {
        await setCollection(STORAGE_KEYS.MEDIA, newMedia);
    }

    return { added: addedCount };
}
