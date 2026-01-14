import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Attachment, AttachmentSource, MediaImage, PromptSet, PromptVersion } from '@/types';
import { getCurrentUser } from './auth';
import { generateId } from './storage';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload a file as an attachment
 */
export async function uploadAttachment(file: File, name?: string): Promise<Attachment | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    // Validate file size
    if (file.size > MAX_ATTACHMENT_SIZE) {
        throw new Error(`File size exceeds maximum of ${MAX_ATTACHMENT_SIZE / (1024 * 1024)}MB`);
    }

    const id = generateId();
    const attachmentName = name || file.name.replace(/\.[^/.]+$/, ''); // Remove extension for name
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'bin';
    const storagePath = `attachments/${currentUser.id}/${id}_${timestamp}.${extension}`;

    // Convert file to base64 for uploadString
    const reader = new FileReader();
    const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, base64Data, 'data_url');
    const url = await getDownloadURL(storageRef);

    const attachment: Attachment = {
        id,
        name: attachmentName,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        mimeType: file.type || 'application/octet-stream',
        url,
        source: 'upload',
        createdAt: new Date().toISOString(),
    };

    return attachment;
}

/**
 * Create an attachment from a Media Library item
 */
export async function attachFromMedia(media: MediaImage, name?: string): Promise<Attachment> {
    const id = generateId();

    // Determine type from URL
    const isImage = media.url.includes('image') ||
        /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(media.url) ||
        media.url.startsWith('data:image');

    const attachment: Attachment = {
        id,
        name: name || `media_${media.id.substring(0, 8)}`,
        type: isImage ? 'image' : 'file',
        mimeType: isImage ? 'image/png' : 'application/octet-stream',
        url: media.url,
        source: 'media',
        sourceId: media.id,
        createdAt: new Date().toISOString(),
    };

    return attachment;
}

/**
 * Create an attachment from a PromptSet version
 */
export async function attachFromVersion(
    version: PromptVersion,
    promptSet: PromptSet,
    name?: string
): Promise<Attachment | null> {
    // Version must have an image
    if (!version.imageUrl) {
        return null;
    }

    const id = generateId();

    const attachment: Attachment = {
        id,
        name: name || `${promptSet.title}_v${version.versionNumber}`,
        type: 'image',
        mimeType: 'image/png',
        url: version.imageUrl,
        source: 'promptset_version',
        sourceId: version.id,
        sourcePromptSetId: promptSet.id,
        sourcePromptSetTitle: promptSet.title,
        createdAt: new Date().toISOString(),
    };

    return attachment;
}

/**
 * Delete an attachment from storage (only for uploaded files)
 */
export async function deleteAttachment(attachment: Attachment): Promise<boolean> {
    // Only delete uploaded files from storage
    if (attachment.source !== 'upload') {
        return true; // Nothing to delete, just remove reference
    }

    try {
        // Extract path from URL
        const url = new URL(attachment.url);
        const pathMatch = url.pathname.match(/\/o\/(.+)\?/);
        if (pathMatch) {
            const storagePath = decodeURIComponent(pathMatch[1]);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
        }
        return true;
    } catch (error) {
        console.error('Failed to delete attachment from storage:', error);
        return false;
    }
}

/**
 * Resolve attachment references in prompt text
 * Replaces {{file:name}} with the attachment URL or a placeholder
 */
export function resolveAttachmentReferences(
    promptText: string,
    attachments: Attachment[]
): { resolved: string; unresolvedRefs: string[] } {
    const unresolvedRefs: string[] = [];

    // Match {{file:name}} pattern
    const resolved = promptText.replace(/\{\{file:([^}]+)\}\}/g, (match, name) => {
        const attachment = attachments.find(a => a.name === name.trim());
        if (attachment) {
            return `[Attached Image: ${attachment.name}](${attachment.url})`;
        }
        unresolvedRefs.push(name.trim());
        return match; // Return original if not found
    });

    return { resolved, unresolvedRefs };
}

/**
 * Generate a unique attachment name if there's a conflict
 */
export function generateUniqueName(baseName: string, existingNames: string[]): string {
    if (!existingNames.includes(baseName)) {
        return baseName;
    }

    let counter = 1;
    let newName = `${baseName}_${counter}`;
    while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName}_${counter}`;
    }
    return newName;
}

/**
 * Validate attachment name (alphanumeric, underscores, hyphens)
 */
export function isValidAttachmentName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0 && name.length <= 50;
}

/**
 * Sanitize a name to be a valid attachment name
 */
export function sanitizeAttachmentName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 50) || 'attachment';
}
