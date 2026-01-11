import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-middleware';
import { ApiKey } from '@/types';

/**
 * POST /api/keys/bootstrap - Create the first API key without authentication
 * This endpoint is used to bootstrap the API key system
 * 
 * Body: { userId: string, name: string, description?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, name, description } = body;

        if (!userId || !name) {
            return NextResponse.json(
                { success: false, error: 'userId and name are required' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore();

        // Check if user already has API keys
        const existingKeys = await db.collection('apiKeys')
            .where('userId', '==', userId)
            .limit(1)
            .get();

        if (!existingKeys.empty) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'User already has API keys. Use the regular /api/keys endpoint with authentication.'
                },
                { status: 403 }
            );
        }

        // Generate new API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = getKeyPrefix(apiKey);

        const keyId = db.collection('apiKeys').doc().id;

        const newKey: ApiKey = {
            id: keyId,
            userId,
            name,
            description: description || '',
            keyHash,
            keyPrefix,
            createdAt: new Date().toISOString(),
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
        console.error('Bootstrap key creation error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create bootstrap API key',
            },
            { status: 500 }
        );
    }
}
