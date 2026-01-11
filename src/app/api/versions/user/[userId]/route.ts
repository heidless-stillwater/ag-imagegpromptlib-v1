import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet, VersionWithMetadata } from '@/types';

/**
 * GET /api/versions/user/[userId] - Retrieve all versions for a specific user
 * Returns a flattened array of versions with metadata
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

        // Get target user info
        const targetUserDoc = await db.collection('users').doc(userId).get();
        if (!targetUserDoc.exists) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }
        const targetUserData = targetUserDoc.data();

        // Query prompt sets for the specified user
        const promptSetsRef = db.collection('promptSets');
        const promptSetsSnapshot = await promptSetsRef
            .where('userId', '==', userId)
            .orderBy('updatedAt', 'desc')
            .get();

        // Flatten all versions with metadata
        const allVersions: VersionWithMetadata[] = [];

        for (const doc of promptSetsSnapshot.docs) {
            const promptSet = doc.data() as PromptSet;

            // Add each version with metadata
            for (const version of promptSet.versions) {
                allVersions.push({
                    ...version,
                    promptSetTitle: promptSet.title,
                    promptSetDescription: promptSet.description,
                    promptSetCategoryId: promptSet.categoryId,
                    userName: targetUserData?.displayName || targetUserData?.username || 'Unknown',
                    userEmail: targetUserData?.email || '',
                });
            }
        }

        // Sort by creation date (newest first)
        allVersions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return NextResponse.json({
            success: true,
            data: allVersions,
            count: allVersions.length,
            userId,
            userName: targetUserData?.displayName || targetUserData?.username || 'Unknown',
        });
    } catch (error) {
        console.error('Error fetching user versions:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch user versions',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
