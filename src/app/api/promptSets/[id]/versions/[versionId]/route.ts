import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet, PromptVersion } from '@/types';

/**
 * GET /api/promptSets/[id]/versions/[versionId] - Get a specific version of a prompt set
 * returns a specific Version of a Specific PromptSet for a specific User
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    try {
        const authContext = await requireApiAuth(request);
        const { id, versionId } = await params;

        if (!id || !versionId) {
            return NextResponse.json(
                { success: false, error: 'Prompt set ID and Version ID are required' },
                { status: 400 }
            );
        }

        const db = getAdminFirestore();
        const docRef = db.collection('promptSets').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json(
                { success: false, error: 'Prompt set not found' },
                { status: 404 }
            );
        }

        const promptSet = docSnap.data() as PromptSet;

        // Get requesting user info to check if admin
        const requestingUserDoc = await db.collection('users').doc(authContext.userId).get();
        const requestingUserData = requestingUserDoc.data();
        const isAdmin = requestingUserData?.role === 'admin';

        // Check permissions: only owner or admin can view
        if (!isAdmin && promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to view this prompt set' },
                { status: 403 }
            );
        }

        // Find the specific version
        const version = promptSet.versions.find(v => v.id === versionId);

        if (!version) {
            return NextResponse.json(
                { success: false, error: 'Version not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: version,
            promptSetTitle: promptSet.title,
            userId: promptSet.userId,
        });
    } catch (error) {
        console.error('Error fetching prompt set version:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch prompt set version',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
