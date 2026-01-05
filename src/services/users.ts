import { User, InviteLink } from '@/types';
import {
    STORAGE_KEYS,
    getCollection,
    setCollection,
    generateId,
    getTimestamp
} from './storage';
import { getAllUsers, getCurrentUser, getUserById } from './auth';

/**
 * Search users by email or display name
 */
export function searchUsers(query: string): User[] {
    if (!query.trim()) return [];

    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const allUsers = getAllUsers();
    const lowerQuery = query.toLowerCase();

    return allUsers.filter(user =>
        user.id !== currentUser.id && // Exclude self
        user.isPublic && // Only public users
        (user.email.toLowerCase().includes(lowerQuery) ||
            user.displayName.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Get public user directory
 */
export function getPublicDirectory(): User[] {
    const currentUser = getCurrentUser();
    const allUsers = getAllUsers();

    return allUsers.filter(user =>
        user.isPublic &&
        (!currentUser || user.id !== currentUser.id) // Exclude self if logged in
    );
}

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create an invite link
 */
export function createInviteLink(expiresInDays?: number): InviteLink | null {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const now = new Date();
    let expiresAt: string | undefined;

    if (expiresInDays) {
        const expiry = new Date(now);
        expiry.setDate(expiry.getDate() + expiresInDays);
        expiresAt = expiry.toISOString();
    }

    const inviteLink: InviteLink = {
        id: generateId(),
        creatorId: currentUser.id,
        code: generateInviteCode(),
        expiresAt,
        createdAt: now.toISOString(),
    };

    const links = getCollection<InviteLink>(STORAGE_KEYS.INVITE_LINKS);
    setCollection(STORAGE_KEYS.INVITE_LINKS, [...links, inviteLink]);

    return inviteLink;
}

/**
 * Resolve an invite code to a user
 */
export function resolveInviteLink(code: string): User | null {
    const links = getCollection<InviteLink>(STORAGE_KEYS.INVITE_LINKS);
    const link = links.find(l => l.code.toUpperCase() === code.toUpperCase());

    if (!link) return null;

    // Check expiry
    if (link.expiresAt) {
        const expiryDate = new Date(link.expiresAt);
        if (expiryDate < new Date()) {
            return null; // Expired
        }
    }

    return getUserById(link.creatorId);
}

/**
 * Get invite links created by current user
 */
export function getMyInviteLinks(): InviteLink[] {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const links = getCollection<InviteLink>(STORAGE_KEYS.INVITE_LINKS);
    return links.filter(l => l.creatorId === currentUser.id);
}

/**
 * Delete an invite link
 */
export function deleteInviteLink(id: string): boolean {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    const links = getCollection<InviteLink>(STORAGE_KEYS.INVITE_LINKS);
    const link = links.find(l => l.id === id);

    if (!link || link.creatorId !== currentUser.id) {
        return false;
    }

    const filtered = links.filter(l => l.id !== id);
    setCollection(STORAGE_KEYS.INVITE_LINKS, filtered);

    return true;
}

/**
 * Get the full invite URL for a link
 */
export function getInviteUrl(code: string): string {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/invite/${code}`;
    }
    return `/invite/${code}`;
}
