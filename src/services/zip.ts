import JSZip from 'jszip';
import { MediaImage } from '@/types';
import { uploadToStorage } from './upload';
import { addMediaImage, checkMediaExistsById, normalizeMediaUrl } from './media';
import { getCurrentUser } from './auth';
import { generateDeterministicId } from '@/lib/utils';
import { storage } from '@/lib/firebase';

export type Resolution = 'overwrite' | 'skip' | 'overwriteAll' | 'skipAll';
export type ConflictHandler = (filename: string, previewUrl?: string) => Promise<Resolution>;

interface ZipMetadata {
    images: {
        id?: string;
        filename: string;
        originalUrl: string;
        promptSetId?: string;
        versionId?: string;
        createdAt: string;
        userId: string;
    }[];
    version: string;
}

/**
 * Export selected images to a compressed ZIP
 */
export async function exportMediaZip(images: MediaImage[]): Promise<Blob> {
    const zip = new JSZip();
    const metadata: ZipMetadata = {
        images: [],
        version: '1.0'
    };

    const mediaFolder = zip.folder('media');

    // Fetch and add images
    const tasks = images.map(async (img) => {
        try {
            const response = await fetch(img.url);
            if (!response.ok) throw new Error(`Failed to fetch ${img.url}`);

            const blob = await response.blob();
            const extension = blob.type.split('/')[1] || 'png';
            const filename = `${img.id}.${extension}`;

            mediaFolder?.file(filename, blob);

            metadata.images.push({
                id: img.id,
                filename,
                originalUrl: img.url,
                promptSetId: img.promptSetId,
                versionId: img.versionId,
                createdAt: img.createdAt,
                userId: img.userId
            });
        } catch (error) {
            console.error(`Error adding image ${img.id} to ZIP:`, error);
        }
    });

    await Promise.all(tasks);

    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Restore media from a ZIP file
 */
export async function restoreMediaFromZip(
    file: File,
    onConflict: ConflictHandler
): Promise<{ restored: number; skipped: number; total: number }> {
    const zip = await JSZip.loadAsync(file);
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) throw new Error('Invalid backup: metadata.json missing');

    const metadata: ZipMetadata = JSON.parse(await metadataFile.async('string'));
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Authentication required');

    let restored = 0;
    let skipped = 0;
    let bulkResolution: Resolution | null = null;
    const previewUrls: string[] = [];

    const bucket = storage.app.options.storageBucket;

    for (const imgMeta of metadata.images) {
        // Calculate the predicted ID in the CURRENT user's library
        // We use a stable path for restoration to ensure ID stability
        // Use imgMeta.id or the ID from the filename as a fallback
        const originalId = imgMeta.id || imgMeta.filename.split('.')[0];
        const stablePath = `users/${currentUser.id}/media/restored_${originalId}`;

        // Construct the URL exactly as Firebase Storage does (base URL + encoded path + alt=media)
        const rawUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(stablePath)}?alt=media`;
        const normalizedUrl = normalizeMediaUrl(rawUrl);
        const predictedId = await generateDeterministicId(`${currentUser.id}-${normalizedUrl}`);

        const exists = await checkMediaExistsById(predictedId);

        let resolution: Resolution = 'overwrite';

        if (exists) {
            if (bulkResolution === 'overwriteAll') {
                resolution = 'overwrite';
            } else if (bulkResolution === 'skipAll') {
                resolution = 'skip';
            } else {
                // Get preview from ZIP
                let previewUrl: string | undefined;
                try {
                    const zipFile = zip.file(`media/${imgMeta.filename}`);
                    if (zipFile) {
                        const blob = await zipFile.async('blob');
                        previewUrl = URL.createObjectURL(blob);
                        previewUrls.push(previewUrl);
                    }
                } catch (e) {
                    console.warn('Could not create preview for conflict', e);
                }

                resolution = await onConflict(imgMeta.filename, previewUrl);
                if (resolution === 'overwriteAll') bulkResolution = 'overwriteAll';
                if (resolution === 'skipAll') bulkResolution = 'skipAll';
            }
        }

        if (resolution === 'skip' || resolution === 'skipAll') {
            skipped++;
            continue;
        }

        // Process restoration
        try {
            const zipFile = zip.file(`media/${imgMeta.filename}`);
            if (!zipFile) continue;

            const blob = await zipFile.async('blob');

            // Upload to storage with the STABLE path (overwrites if file exists in storage)
            const newUrl = await uploadToStorage(stablePath, blob, { contentType: blob.type });

            // Add/Overwrite in Firestore using the stable URL and ID
            await addMediaImage(newUrl, {
                promptSetId: imgMeta.promptSetId,
                versionId: imgMeta.versionId
            }, true); // Use overwrite true to replace existing record

            restored++;
        } catch (error) {
            console.error(`Error restoring ${imgMeta.filename}:`, error);
        }
    }

    // Cleanup preview URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    return { restored, skipped, total: metadata.images.length };
}
