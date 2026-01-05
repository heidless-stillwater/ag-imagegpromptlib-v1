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
import { User, InviteLink } from '@/types';
import { getCurrentUser, getUserById, getAllUsers } from './auth';
import { generateId } from './storage';
import { sanitizeData } from '@/lib/firestore';

const INVITE_COLLECTION = 'inviteLinks';

/**
 * Search users
 */
export async function searchUsers(searchTerm: string): Promise<User[]> {
    if (!searchTerm.trim()) return [];

    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();
    const lowerQuery = searchTerm.toLowerCase();

    return allUsers.filter(user =>
        user.id !== currentUser?.id &&
        user.isPublic &&
        (user.email.toLowerCase().includes(lowerQuery) ||
            user.displayName.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Get public directory
 */
export async function getPublicDirectory(): Promise<User[]> {
    const currentUser = await getCurrentUser();
    const allUsers = await getAllUsers();

    return allUsers.filter(user =>
        user.isPublic &&
        (!currentUser || user.id !== currentUser.id)
    );
}

/**
 * Generate invite code
 */
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create invite link
 */
export async function createInviteLink(expiresInDays?: number): Promise<InviteLink | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    const now = new Date();
    let expiresAt: string | undefined;

    if (expiresInDays) {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + expiresInDays);
        expiresAt = expiry.toISOString();
    }

    const id = generateId();
    const inviteLink: InviteLink = {
        id,
        creatorId: currentUser.id,
        code: generateInviteCode(),
        expiresAt,
        createdAt: now.toISOString(),
    };

    await setDoc(doc(db, INVITE_COLLECTION, id), sanitizeData(inviteLink));
    return inviteLink;
}

/**
 * Resolve invite code
 */
export async function resolveInviteLink(code: string): Promise<User | null> {
    const colRef = collection(db, INVITE_COLLECTION);
    const q = query(colRef, where('code', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const link = snapshot.docs[0].data() as InviteLink;

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return null;
    }

    return await getUserById(link.creatorId);
}

/**
 * Get my invite links
 */
export async function getMyInviteLinks(): Promise<InviteLink[]> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];

    const colRef = collection(db, INVITE_COLLECTION);
    const q = query(colRef, where('creatorId', '==', currentUser.id), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as InviteLink);
}

/**
 * Delete invite link
 */
export async function deleteInviteLink(id: string): Promise<boolean> {
    await deleteDoc(doc(db, INVITE_COLLECTION, id));
    return true;
}

/**
 * Get invite URL
 */
export function getInviteUrl(code: string): string {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/invite/${code}`;
    }
    return `/invite/${code}`;
}
