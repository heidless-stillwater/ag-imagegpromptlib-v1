import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet, VersionWithMetadata } from '@/types';

/**
 * GET /api/versions - Retrieve all versions from all prompt sets
 * Returns a flattened array of versions with metadata
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

        const promptSetsSnapshot = await promptSetsQuery.get();

        // Flatten all versions with metadata
        const allVersions: VersionWithMetadata[] = [];

        for (const doc of promptSetsSnapshot.docs) {
            const promptSet = doc.data() as PromptSet;

            // Get user info for this prompt set
            const ownerDoc = await db.collection('users').doc(promptSet.userId).get();
            const ownerData = ownerDoc.data();

            // Add each version with metadata
            for (const version of promptSet.versions) {
                allVersions.push({
                    ...version,
                    promptSetTitle: promptSet.title,
                    promptSetDescription: promptSet.description,
                    promptSetCategoryId: promptSet.categoryId,
                    userName: ownerData?.displayName || ownerData?.username || 'Unknown',
                    userEmail: ownerData?.email || '',
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
        });
    } catch (error) {
        console.error('Error fetching versions:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch versions',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
