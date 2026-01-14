import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

/*
 * ================================================
 * GEMINI IMAGE GENERATION API ROUTE
 * ================================================
 * 
 * IMPORTANT: This route makes actual API calls to Gemini.
 * The client-side code should ALWAYS show a confirmation
 * modal before calling this endpoint.
 * 
 * Supports multimodal requests: text + images
 * ================================================
 */

interface ImageInput {
    data: string;      // Base64 data (without data URL prefix)
    mimeType: string;  // e.g., 'image/png', 'image/jpeg'
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, testConnection, apiKey: userApiKey, images } = body as {
            prompt: string;
            testConnection?: boolean;
            apiKey?: string;
            images?: ImageInput[];
        };

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
                await genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
                return NextResponse.json({
                    success: true,
                    message: 'Connection verified successfully.'
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

        console.log('Using model: gemini-2.5-flash-image');
        // Reverting to the user's original model which likely has specific Imagen-related configurations
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image',
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_HARASSMENT' as any,
                    threshold: 'BLOCK_NONE' as any,
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH' as any,
                    threshold: 'BLOCK_NONE' as any,
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any,
                    threshold: 'BLOCK_NONE' as any,
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any,
                    threshold: 'BLOCK_NONE' as any,
                },
            ],
        });

        // Build content parts for multimodal request
        const parts: Part[] = [];

        // Add image parts first (if any)
        if (images && images.length > 0) {
            console.log(`Sending ${images.length} images to Gemini`);
            for (const img of images) {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data,
                    }
                });
            }
        }

        // Add text prompt
        const seed = Date.now();
        const styleInstruction = body.backgroundStyle ? `, ${body.backgroundStyle}` : '';
        const imagePrompt = images && images.length > 0
            ? `IMPORTANT: You MUST generate a NEW IMAGE in your response. Base the new image on these instructions: ${prompt}${styleInstruction}. Use the attached image(s) as visual reference/context for the transformation. [variation_id: ${seed}]`
            : `Generate a detailed, high-quality image based on this description: ${prompt}${styleInstruction}. Make it visually stunning with rich colors and professional composition. [variation_id: ${seed}]`;

        console.log('Gemini prompt:', imagePrompt);

        parts.push({ text: imagePrompt });

        const result = await model.generateContent(parts);
        const response = result.response;

        // Check for image data in the response
        let imageUrl: string | null = null;

        console.log('Gemini candidates:', response.candidates?.length);

        for (const candidate of response.candidates || []) {
            console.log('Candidate parts:', candidate.content?.parts?.length);
            for (const part of candidate.content?.parts || []) {
                if ('inlineData' in part && part.inlineData?.mimeType?.startsWith('image/')) {
                    console.log('Found image in response!');
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                } else if ('text' in part && typeof part.text === 'string') {
                    console.log('Found text in response:', part.text.substring(0, 100));
                }
            }
            if (imageUrl) break;
        }

        if (!imageUrl) {
            const textResponse = response.text?.() || 'No response';
            return NextResponse.json({
                success: false,
                error: `Image generation failed. Response: ${textResponse.substring(0, 200)}`,
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
