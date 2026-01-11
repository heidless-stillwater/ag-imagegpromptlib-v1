import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet, PromptVersion } from '@/types';

/**
 * GET /api/promptSets - List all accessible prompt sets
 */
export async function GET(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const db = getAdminFirestore();

        // Get user info to check if admin
        const userDoc = await db.collection('users').doc(authContext.userId).get();
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin';

        // Query prompt sets based on permissions
        const promptSetsRef = db.collection('promptSets');
        let promptSetsQuery;

        if (isAdmin) {
            // Admin sees all prompt sets
            promptSetsQuery = promptSetsRef.orderBy('updatedAt', 'desc');
        } else {
            // Regular users see only their own
            promptSetsQuery = promptSetsRef
                .where('userId', '==', authContext.userId)
                .orderBy('updatedAt', 'desc');
        }

        const snapshot = await promptSetsQuery.get();
        const promptSets: PromptSet[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as PromptSet));

        return NextResponse.json({
            success: true,
            data: promptSets,
            count: promptSets.length,
        });
    } catch (error) {
        console.error('Error fetching prompt sets:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch prompt sets',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * POST /api/promptSets - Create a new prompt set
 * Body: { title: string, description?: string, categoryId?: string, notes?: string, initialPrompt?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const authContext = await requireApiAuth(request);
        const body = await request.json();

        const { title, description, categoryId, notes, initialPrompt } = body;

        if (!title || typeof title !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Title is required' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore();
        const now = new Date().toISOString();
        const id = db.collection('promptSets').doc().id;

        const versions: PromptVersion[] = initialPrompt
            ? [{
                id: db.collection('promptSets').doc().id,
                promptSetId: id,
                versionNumber: 1,
                promptText: initialPrompt,
                createdAt: now,
                updatedAt: now,
            }]
            : [];

        const newSet: PromptSet = {
            id,
            userId: authContext.userId,
            title,
            description: description || '',
            categoryId: categoryId || '',
            notes: notes || '',
            versions,
            createdAt: now,
            updatedAt: now,
        };

        await db.collection('promptSets').doc(id).set(newSet);

        return NextResponse.json({
            success: true,
            data: newSet,
        });
    } catch (error) {
        console.error('Error creating prompt set:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create prompt set',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
