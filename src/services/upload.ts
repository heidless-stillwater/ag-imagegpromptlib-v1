import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Upload a Base64 string or Blob to Firebase Storage
 * Returns the public download URL
 */
export async function uploadToStorage(
    path: string,
    data: string | Blob | File,
    metadata: { contentType?: string } = {}
): Promise<string> {
    try {
        const storageRef = ref(storage, path);

        if (typeof data === 'string') {
            // Assume Base64 string if it starts with 'data:'
            if (data.startsWith('data:')) {
                await uploadString(storageRef, data, 'data_url', metadata);
            } else {
                throw new Error('Invalid string format. Expected data_url.');
            }
        } else {
            // Blob or File
            await uploadBytes(storageRef, data, metadata);
        }

        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error('Storage upload error:', error);
        throw error;
    }
}

/**
 * Upload User Avatar
 * Stores in /users/{userId}/avatar.jpg (or png)
 */
export async function uploadUserAvatar(userId: string, dataUrl: string): Promise<string> {
    // Generate a timestamp or unique ID to prevent cache issues if we want granular history,
    // but typically a user has one current avatar. 
    // Let's use 'avatar' filename but maybe query param for cache busting in UI.
    // Actually, distinct filenames are safer for caching.
    const timestamp = Date.now();
    const path = `users/${userId}/avatars/${timestamp}.jpg`;

    // We assume dataUrl is jpeg/png.
    return uploadToStorage(path, dataUrl);
}
