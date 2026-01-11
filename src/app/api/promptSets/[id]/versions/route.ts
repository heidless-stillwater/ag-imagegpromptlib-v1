import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet, PromptVersion } from '@/types';

/**
 * POST /api/promptSets/[id]/versions - Add a new version to a prompt set
 * Body: { promptText: string, notes?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authContext = await requireApiAuth(request);
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Prompt set ID is required' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { promptText, notes } = body;

        if (!promptText || typeof promptText !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Prompt text is required' },
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

        // Check permissions (only owner can add versions)
        if (promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to modify this prompt set' },
                { status: 403 }
            );
        }

        const now = new Date().toISOString();
        const maxVersionNumber = promptSet.versions.reduce(
            (max, v) => Math.max(max, v.versionNumber),
            0
        );

        const newVersion: PromptVersion = {
            id: db.collection('promptSets').doc().id,
            promptSetId: id,
            versionNumber: maxVersionNumber + 1,
            promptText,
            notes: notes || '',
            createdAt: now,
            updatedAt: now,
        };

        await docRef.update({
            versions: [...promptSet.versions, newVersion],
            updatedAt: now,
        });

        return NextResponse.json({
            success: true,
            data: newVersion,
        });
    } catch (error) {
        console.error('Error adding version:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add version',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * PATCH /api/promptSets/[id]/versions?versionId=<versionId> - Update a version
 * Body: { promptText?: string, notes?: string, imageUrl?: string }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authContext = await requireApiAuth(request);
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const versionId = searchParams.get('versionId');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Prompt set ID is required' },
                { status: 400 }
            );
        }

        if (!versionId) {
            return NextResponse.json(
                { success: false, error: 'Version ID is required' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { promptText, notes, imageUrl } = body;

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

        // Check permissions (only owner can update versions)
        if (promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to modify this prompt set' },
                { status: 403 }
            );
        }

        const versionIndex = promptSet.versions.findIndex(v => v.id === versionId);
        if (versionIndex === -1) {
            return NextResponse.json(
                { success: false, error: 'Version not found' },
                { status: 404 }
            );
        }

        const now = new Date().toISOString();
        const updatedVersion = {
            ...promptSet.versions[versionIndex],
            updatedAt: now,
        };

        if (promptText !== undefined) updatedVersion.promptText = promptText;
        if (notes !== undefined) updatedVersion.notes = notes;
        if (imageUrl !== undefined) {
            updatedVersion.imageUrl = imageUrl;
            updatedVersion.imageGeneratedAt = now;
        }

        const updatedVersions = [...promptSet.versions];
        updatedVersions[versionIndex] = updatedVersion;

        await docRef.update({
            versions: updatedVersions,
            updatedAt: now,
        });

        return NextResponse.json({
            success: true,
            data: updatedVersion,
        });
    } catch (error) {
        console.error('Error updating version:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update version',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * DELETE /api/promptSets/[id]/versions?versionId=<versionId> - Delete a version
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authContext = await requireApiAuth(request);
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const versionId = searchParams.get('versionId');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Prompt set ID is required' },
                { status: 400 }
            );
        }

        if (!versionId) {
            return NextResponse.json(
                { success: false, error: 'Version ID is required' },
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

        // Check permissions (only owner can delete versions)
        if (promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to modify this prompt set' },
                { status: 403 }
            );
        }

        const filteredVersions = promptSet.versions.filter(v => v.id !== versionId);

        if (filteredVersions.length === promptSet.versions.length) {
            return NextResponse.json(
                { success: false, error: 'Version not found' },
                { status: 404 }
            );
        }

        await docRef.update({
            versions: filteredVersions,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            data: { id: versionId },
        });
    } catch (error) {
        console.error('Error deleting version:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete version',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
