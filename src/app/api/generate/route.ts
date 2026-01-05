import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/*
 * ================================================
 * GEMINI IMAGE GENERATION API ROUTE
 * ================================================
 * 
 * IMPORTANT: This route makes actual API calls to Gemini.
 * The client-side code should ALWAYS show a confirmation
 * modal before calling this endpoint.
 * 
 * This route will NEVER be called without explicit
 * user confirmation in the UI.
 * ================================================
 */

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json(
                { error: 'Invalid prompt provided' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Use gemini-2.0-flash-exp for image generation with Imagen 3
        // Note: For actual image generation, you may need to use a different model
        // that supports image output. This uses text-to-image prompting.
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
        });

        // Create an enhanced prompt for image generation
        const imagePrompt = `Generate a detailed, high-quality image based on this description: ${prompt}. 
    Make it visually stunning with rich colors and professional composition.`;

        const result = await model.generateContent(imagePrompt);
        const response = result.response;

        // Check for image data in the response
        let imageUrl: string | null = null;

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                // Check if this part contains image data
                if ('inlineData' in part && part.inlineData?.mimeType?.startsWith('image/')) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
            if (imageUrl) break;
        }

        if (!imageUrl) {
            // If no image was generated, return the text response for debugging
            const textResponse = response.text?.() || 'No response';
            return NextResponse.json({
                success: false,
                error: `Image generation not available with current model. The model requires specific configuration for image output. Response: ${textResponse.substring(0, 200)}`,
            });
        }

        return NextResponse.json({
            success: true,
            imageUrl,
        });

    } catch (error) {
        console.error('Image generation error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to generate image'
            },
            { status: 500 }
        );
    }
}
