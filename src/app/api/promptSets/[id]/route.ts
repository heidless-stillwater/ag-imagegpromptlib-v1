import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireApiAuth } from '@/lib/api-middleware';
import { PromptSet } from '@/types';

/**
 * GET /api/promptSets/[id] - Get a single prompt set by ID
 */
export async function GET(
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

        // Get user info to check if admin
        const userDoc = await db.collection('users').doc(authContext.userId).get();
        const userData = userDoc.data();
        const isAdmin = userData?.role === 'admin';

        // Check permissions
        if (!isAdmin && promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to view this prompt set' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: promptSet,
        });
    } catch (error) {
        console.error('Error fetching prompt set:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch prompt set',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * PATCH /api/promptSets/[id] - Update a prompt set
 * Body: { title?: string, description?: string, categoryId?: string, notes?: string }
 */
export async function PATCH(
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
        const { title, description, categoryId, notes } = body;

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

        // Check permissions (only owner can update)
        if (promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to update this prompt set' },
                { status: 403 }
            );
        }

        const updates: Partial<PromptSet> = {
            updatedAt: new Date().toISOString(),
        };

        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (categoryId !== undefined) updates.categoryId = categoryId;
        if (notes !== undefined) updates.notes = notes;

        await docRef.update(updates);

        const updatedSet = {
            ...promptSet,
            ...updates,
        };

        return NextResponse.json({
            success: true,
            data: updatedSet,
        });
    } catch (error) {
        console.error('Error updating prompt set:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update prompt set',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}

/**
 * DELETE /api/promptSets/[id] - Delete a prompt set
 */
export async function DELETE(
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

        // Check permissions (only owner can delete)
        if (promptSet.userId !== authContext.userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized to delete this prompt set' },
                { status: 403 }
            );
        }

        await docRef.delete();

        return NextResponse.json({
            success: true,
            data: { id },
        });
    } catch (error) {
        console.error('Error deleting prompt set:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete prompt set',
            },
            { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
        );
    }
}
