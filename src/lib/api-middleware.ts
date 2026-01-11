import { NextRequest } from 'next/server';
import { getAdminFirestore, getAdminAuth } from './firebase-admin';
import * as crypto from 'crypto';

export interface ApiAuthContext {
    userId: string;
    keyId?: string; // Optional because Firebase Auth tokens don't have a keyId
    isValid: boolean;
    authType: 'apiKey' | 'firebase';
}

/**
 * Validate API key from request headers
 * @param request Next.js request object
 * @returns Authentication context with user info if valid
 */
export async function validateApiKey(request: NextRequest): Promise<ApiAuthContext | null> {
    const authHeader = request.headers.get('authorization') || '';
    const xApiKey = request.headers.get('x-api-key');

    const token = xApiKey || authHeader.replace('Bearer ', '');

    if (!token) {
        return null;
    }

    try {
        // 1. Try validating as API Key (starts with pk_live_)
        if (token.startsWith('pk_live_')) {
            const keyHash = hashApiKey(token);
            const db = getAdminFirestore();
            const keysRef = db.collection('apiKeys');
            const snapshot = await keysRef.where('keyHash', '==', keyHash).limit(1).get();

            if (!snapshot.empty) {
                const keyDoc = snapshot.docs[0];
                const keyData = keyDoc.data();

                if (!(keyData.expiresAt && new Date(keyData.expiresAt) < new Date())) {
                    await keyDoc.ref.update({
                        lastUsed: new Date().toISOString(),
                    });

                    return {
                        userId: keyData.userId,
                        keyId: keyDoc.id,
                        isValid: true,
                        authType: 'apiKey',
                    };
                }
            }
        }

        // 2. Try validating as Firebase ID Token
        try {
            const auth = getAdminAuth();
            const decodedToken = await auth.verifyIdToken(token);
            if (decodedToken) {
                return {
                    userId: decodedToken.uid,
                    isValid: true,
                    authType: 'firebase',
                };
            }
        } catch (authError) {
            // Not a valid Firebase token or error during verification
            // Fall through to return null
        }

        return null;
    } catch (error) {
        console.error('Authentication validation error:', error);
        return null;
    }
}

/**
 * Hash an API key using SHA-256
 * @param key The API key to hash
 * @returns Hashed key
 */
export function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a secure API key
 * @param prefix Optional prefix (default: 'pk_live_')
 * @returns Generated API key
 */
export function generateApiKey(prefix: string = 'pk_live_'): string {
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}${key}`;
}

/**
 * Get key prefix for display (first 12 characters)
 * @param key Full API key
 * @returns Key prefix
 */
export function getKeyPrefix(key: string): string {
    return key.substring(0, 12) + '...';
}

/**
 * Middleware to require API authentication
 * Returns 401 if authentication fails
 */
export async function requireApiAuth(request: NextRequest): Promise<ApiAuthContext> {
    const authContext = await validateApiKey(request);

    if (!authContext) {
        throw new Error('Unauthorized: Invalid or missing API key');
    }

    return authContext;
}
