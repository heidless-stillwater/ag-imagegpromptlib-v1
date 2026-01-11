import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet } from '@/types';

/**
 * GET /api/promptSets/user/[userId] - Retrieve all prompt sets for a specific user
 * returns a list of all promptSets for a particular User
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const authContext = await requireApiAuth(request);
        const { userId } = await params;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore();

        // Get requesting user info to check if admin
        const requestingUserDoc = await db.collection('users').doc(authContext.userId).get();
        const requestingUserData = requestingUserDoc.data();
        const isAdmin = requestingUserData?.role === 'admin';

        // Check permissions: users can only see their own data unless admin
        if (!isAdmin && authContext.userId !== userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to view this user\'s data' },
                { status: 403 }
            );
        }

        // Query prompt sets for the specified user
        const promptSetsRef = db.collection('promptSets');
        const snapshot = await promptSetsRef
            .where('userId', '==', userId)
            .orderBy('updatedAt', 'desc')
            .get();

        const promptSets: PromptSet[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as PromptSet));

        return NextResponse.json({
            success: true,
            data: promptSets,
            count: promptSets.length,
            userId,
        });
    } catch (error) {
        console.error('Error fetching user prompt sets:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch user prompt sets',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
