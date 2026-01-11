import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { generateApiKey, hashApiKey, getKeyPrefix, requireApiAuth } from '@/lib/api-middleware';
import { ApiKey } from '@/types';

/**
 * GET /api/keys - List all API keys for the authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const db = getAdminFirestore();

        const keysRef = db.collection('apiKeys');
        const snapshot = await keysRef
            .where('userId', '==', authContext.userId)
            .orderBy('createdAt', 'desc')
            .get();

        const keys: ApiKey[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as ApiKey));

        return NextResponse.json({
            success: true,
            data: keys,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch API keys',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * POST /api/keys - Create a new API key
 * Body: { name: string, description?: string, expiresAt?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const body = await request.json();

        const { name, description, expiresAt } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Name is required' },
                { status: 400 }
            );
        }

        // Generate new API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = getKeyPrefix(apiKey);

        const db = getAdminFirestore();
        const keyId = db.collection('apiKeys').doc().id;

        const newKey: ApiKey = {
            id: keyId,
            userId: authContext.userId,
            name,
            description: description || '',
            keyHash,
            keyPrefix,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt || undefined,
        };

        await db.collection('apiKeys').doc(keyId).set(newKey);

        // Return the full key ONLY on creation
        return NextResponse.json({
            success: true,
            data: {
                ...newKey,
                fullKey: apiKey, // Only shown once!
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create API key',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * DELETE /api/keys?id=<keyId> - Delete an API key
 */
export async function DELETE(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const { searchParams } = new URL(request.url);
        const keyId = searchParams.get('id');

        if (!keyId) {
            return NextResponse.json(
                { success: false, error: 'Key ID is required' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore();
        const keyRef = db.collection('apiKeys').doc(keyId);
        const keyDoc = await keyRef.get();

        if (!keyDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'API key not found' },
                { status: 404 }
            );
        }

        const keyData = keyDoc.data();
        if (keyData?.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to delete this key' },
                { status: 403 }
            );
        }

        await keyRef.delete();

        return NextResponse.json({
            success: true,
            data: { id: keyId },
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete API key',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * PATCH /api/keys?id=<keyId> - Update API key metadata
 * Body: { name?: string, description?: string }
 */
export async function PATCH(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const { searchParams } = new URL(request.url);
        const keyId = searchParams.get('id');

        if (!keyId) {
            return NextResponse.json(
                { success: false, error: 'Key ID is required' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { name, description } = body;

        const db = getAdminFirestore();
        const keyRef = db.collection('apiKeys').doc(keyId);
        const keyDoc = await keyRef.get();

        if (!keyDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'API key not found' },
                { status: 404 }
            );
        }

        const keyData = keyDoc.data();
        if (keyData?.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to update this key' },
                { status: 403 }
            );
        }

        const updates: Partial<ApiKey> = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;

        await keyRef.update(updates);

        const updatedKey = {
            ...keyData,
            ...updates,
        } as ApiKey;

        return NextResponse.json({
            success: true,
            data: updatedKey,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update API key',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
