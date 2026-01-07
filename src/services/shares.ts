import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Share, PromptSet, Notification } from '@/types';
import { getCurrentUser, getUserById, isAdmin } from './auth';
import { getPromptSetById } from './promptSets';
import { addMediaImage } from './media';
import { generateId } from './storage';
import { duplicateStorageFile } from './upload';
import { createNotification } from './notifications';
import { sanitizeData } from '@/lib/firestore';

const COLLECTION_NAME = 'shares';

/**
 * Create a new share offer
 */
export async function createShare(promptSetId: string, recipientId: string): Promise<Share | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    if (currentUser.id === recipientId) return null;

    const promptSet = await getPromptSetById(promptSetId);
    if (!promptSet) return null;

    if (promptSet.userId !== currentUser.id) return null;

    const recipient = await getUserById(recipientId);
    if (!recipient) return null;

    const id = generateId();
    const now = new Date().toISOString();

    const share: Share = {
        id,
        promptSetId,
        promptSetSnapshot: JSON.parse(JSON.stringify(promptSet)),
        senderId: currentUser.id,
        recipientId,
        state: 'inTransit',
        createdAt: now,
    };

    await setDoc(doc(db, COLLECTION_NAME, id), sanitizeData(share));

    await createNotification(recipientId, 'share_received',
        `${currentUser.displayName} shared "${promptSet.title}" with you`,
        share.id
    );

    return share;
}

/**
 * Get incoming shares
 */
export async function getIncomingShares(state?: Share['state']): Promise<Share[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, COLLECTION_NAME);
    let q = query(colRef, where('recipientId', '==', currentUser.id), orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    let shares = snapshot.docs.map(doc => doc.data() as Share);

    if (state) {
        shares = shares.filter(s => s.state === state);
    }

    return shares;
}

/**
 * Get outgoing shares
 */
export async function getOutgoingShares(state?: Share['state']): Promise<Share[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, COLLECTION_NAME);
    let q = query(colRef, where('senderId', '==', currentUser.id), orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    let shares = snapshot.docs.map(doc => doc.data() as Share);

    if (state) {
        shares = shares.filter(s => s.state === state);
    }

    return shares;
}

/**
 * Get share by ID
 */
export async function getShareById(id: string): Promise<Share | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as Share : null;
}

/**
 * Accept a share
 */
export async function acceptShare(shareId: string): Promise<PromptSet | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const share = await getShareById(shareId);
    if (!share || share.recipientId !== currentUser.id || share.state !== 'inTransit') return null;

    const now = new Date().toISOString();
    const newSetId = generateId();

    // Create copies of each image in each version
    const newVersions = await Promise.all(share.promptSetSnapshot.versions.map(async (v) => {
        const newVersionId = generateId();
        let newImageUrl = v.imageUrl;

        if (v.imageUrl) {
            // Create a physical copy in storage for the recipient
            const storagePath = `generated/${newSetId}/${newVersionId}_copy.png`;
            newImageUrl = await duplicateStorageFile(v.imageUrl, storagePath);
        }

        return {
            ...v,
            id: newVersionId,
            promptSetId: newSetId,
            imageUrl: newImageUrl,
            createdAt: now,
            updatedAt: now,
        };
    }));

    const newPromptSet: PromptSet = {
        ...share.promptSetSnapshot,
        id: newSetId,
        userId: currentUser.id,
        versions: newVersions,
        createdAt: now,
        updatedAt: now,
    };

    // Add to prompt sets
    await setDoc(doc(db, 'promptSets', newSetId), sanitizeData(newPromptSet));
    console.log(`[acceptShare] Created new prompt set: ${newSetId} with ${newVersions.length} versions`);

    // Add images to user's media library
    let addedCount = 0;
    for (const version of newVersions) {
        if (version.imageUrl) {
            console.log(`[acceptShare] Adding version image to media: ${version.imageUrl}`);
            await addMediaImage(version.imageUrl, {
                promptSetId: newSetId,
                versionId: version.id
            });
            addedCount++;
        }
    }
    console.log(`[acceptShare] Finished adding ${addedCount} images to media library`);

    // Update share state
    await updateDoc(doc(db, COLLECTION_NAME, shareId), sanitizeData({
        state: 'accepted',
        respondedAt: now,
    }));

    // Notify sender
    await createNotification(share.senderId, 'share_accepted',
        `${currentUser.displayName} accepted your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return newPromptSet;
}

/**
 * Reject a share
 */
export async function rejectShare(shareId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const share = await getShareById(shareId);
    if (!share || share.recipientId !== currentUser.id || share.state !== 'inTransit') return false;

    const now = new Date().toISOString();
    await updateDoc(doc(db, COLLECTION_NAME, shareId), sanitizeData({
        state: 'rejected',
        respondedAt: now,
    }));

    await createNotification(share.senderId, 'share_rejected',
        `${currentUser.displayName} declined your share of "${share.promptSetSnapshot.title}"`,
        shareId
    );

    return true;
}

/**
 * Remove share
 */
export async function removeShare(shareId: string): Promise<boolean> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return false;

    const share = await getShareById(shareId);
    if (!share) return false;

    // Authorization
    const adminMode = await isAdmin();
    if (!adminMode && share.senderId !== currentUser.id && share.recipientId !== currentUser.id) {
        return false;
    }

    await deleteDoc(doc(db, COLLECTION_NAME, shareId));
    return true;
}
