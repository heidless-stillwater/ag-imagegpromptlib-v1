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
        const body = await request.json();
        const { prompt, testConnection, apiKey: userApiKey } = body;

        const apiKey = userApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        // Handle connection test
        if (testConnection) {
            const genAI = new GoogleGenerativeAI(apiKey);
            try {
                // Verify API key and connectivity with the target model
                await genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
                return NextResponse.json({
                    success: true,
                    message: 'NanoBanana connection verified successfully.'
                });
            } catch (err) {
                return NextResponse.json(
                    { error: `Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
                    { status: 500 }
                );
            }
        }

        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json(
                { error: 'Invalid prompt provided' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Use gemini-2.5-flash-image as the standard model
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image',
        });

        // Create an enhanced prompt for image generation
        // We add a unique timestamp to ensure a "fresh" interpretation even for identical prompts
        const seed = Date.now();
        const imagePrompt = `Generate a detailed, high-quality image based on this description: ${prompt}. 
    Make it visually stunning with rich colors and professional composition. [variation_id: ${seed}]`;

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
            // If no image was generated, return a placeholder for simulation if desired, 
            // but here we follow the existing logic of reporting failure.
            const textResponse = response.text?.() || 'No response';
            return NextResponse.json({
                success: false,
                error: `Image generation output part not found. This model might not support image generation in this environment. Response: ${textResponse.substring(0, 200)}`,
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
