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
        const { prompt, testConnection, apiKey: userApiKey, images, type, operationName, aspectRatio, backgroundStyle } = body as {
            prompt: string;
            testConnection?: boolean;
            apiKey?: string;
            images?: ImageInput[];
            type?: 'image' | 'video' | 'video-status';
            operationName?: string;
            aspectRatio?: string;
            backgroundStyle?: string;
        };

        const apiKey = userApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        // Handle video status check (long running operation)
        if (type === 'video-status' && operationName) {
            const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            console.log('Video status for', operationName, ':', JSON.stringify(data, null, 2));

            if (!response.ok) {
                return NextResponse.json(
                    { error: data.error?.message || 'Failed to check video status' },
                    { status: response.status }
                );
            }

            // Check if finished
            if (data.done) {
                // Detailed check for video data or URI
                let videoUrl = null;
                const findVideo = (obj: any): any => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.video && (obj.video.uri || obj.video.data)) return obj.video;

                    // Search in arrays
                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            const found = findVideo(item);
                            if (found) return found;
                        }
                    }

                    // Search in keys
                    for (const key in obj) {
                        if (key === 'error') continue;
                        const found = findVideo(obj[key]);
                        if (found) return found;
                    }
                    return null;
                };

                const videoObj = findVideo(data);

                if (videoObj) {
                    if (videoObj.data) {
                        const mimeType = videoObj.mimeType || 'video/mp4';
                        videoUrl = `data:${mimeType};base64,${videoObj.data}`;
                    } else if (videoObj.uri) {
                        videoUrl = videoObj.uri;
                        // If it's a relative path or needs an API key for the "files" endpoint
                        if (videoUrl.includes('generativelanguage.googleapis.com') && !videoUrl.includes('key=')) {
                            videoUrl += (videoUrl.includes('?') ? '&' : '?') + `key=${apiKey}`;
                        }
                    }
                }

                if (videoUrl) {
                    return NextResponse.json({
                        success: true,
                        done: true,
                        videoUrl
                    });
                }

                // NEW: Check for safety filters (raiMediaFilteredReasons)
                const findSafetyReasons = (obj: any): string[] | null => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.raiMediaFilteredReasons) return obj.raiMediaFilteredReasons;

                    if (Array.isArray(obj)) {
                        for (const item of obj) {
                            const found = findSafetyReasons(item);
                            if (found) return found;
                        }
                    }

                    for (const key in obj) {
                        if (key === 'error') continue;
                        const found = findSafetyReasons(obj[key]);
                        if (found) return found;
                    }
                    return null;
                };

                const safetyReasons = findSafetyReasons(data);
                if (safetyReasons && safetyReasons.length > 0) {
                    return NextResponse.json({
                        success: false,
                        done: true,
                        error: `Video generation blocked by safety filters: ${safetyReasons.join(', ')}`
                    });
                }

                if (data.error) {
                    return NextResponse.json({
                        success: false,
                        done: true,
                        error: data.error.message || 'Video generation failed'
                    });
                }

                return NextResponse.json({
                    success: false,
                    done: true,
                    error: `Video generation finished but video data could not be located in the response. Full response: ${JSON.stringify(data).substring(0, 500)}`
                });
            }

            return NextResponse.json({
                success: true,
                done: false,
                progress: typeof data.metadata?.progressPercentage === 'number' ? data.metadata.progressPercentage : null
            });
        }

        // Handle connection test
        if (testConnection) {
            const genAI = new GoogleGenerativeAI(apiKey);
            try {
                const modelName = type === 'video' ? 'veo-3.1-fast-generate-preview' : 'gemini-2.5-flash-image';
                await genAI.getGenerativeModel({ model: modelName });
                return NextResponse.json({
                    success: true,
                    message: `Connection to ${modelName} verified successfully.`
                });
            } catch (err) {
                return NextResponse.json(
                    { error: `Connection test failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
                    { status: 500 }
                );
            }
        }

        // Handle Video Generation (predictLongRunning)
        if (type === 'video') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-preview:predictLongRunning?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{
                        prompt: prompt,
                    }],
                    parameters: {
                        sampleCount: 1,
                        aspectRatio: aspectRatio || '16:9',
                        // Using defaults for "minimal file size" preference
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                return NextResponse.json(
                    { error: data.error?.message || 'Failed to start video generation' },
                    { status: response.status }
                );
            }

            return NextResponse.json({
                success: true,
                operationName: data.name // Returns something like "operations/..."
            });
        }

        // Handle Image Generation (generateContent)
        if (!prompt || typeof prompt !== 'string') {
            return NextResponse.json(
                { error: 'Invalid prompt provided' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = 'gemini-2.5-flash-image';

        console.log(`Using model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
            ],
        });

        // Build content parts
        const parts: Part[] = [];

        // Add image parts (only for image generation multimodal)
        if (images && images.length > 0) {
            console.log(`Sending ${images.length} images to Gemini`);
            for (const img of images) {
                parts.push({
                    inlineData: { mimeType: img.mimeType, data: img.data }
                });
            }
        }

        // Add text prompt
        const seed = Date.now();
        const styleInstruction = backgroundStyle ? `, ${backgroundStyle}` : '';
        const ratioInstruction = aspectRatio ? `, aspect ratio ${aspectRatio}` : '';
        const finalPrompt = images && images.length > 0
            ? `IMPORTANT: You MUST generate a NEW IMAGE in your response. Base the new image on these instructions: ${prompt}${styleInstruction}${ratioInstruction}. Use the attached image(s) as visual reference/context for the transformation. [variation_id: ${seed}]`
            : `Generate a detailed, high-quality image based on this description: ${prompt}${styleInstruction}${ratioInstruction}. Make it visually stunning with rich colors and professional composition. [variation_id: ${seed}]`;

        console.log('Gemini prompt:', finalPrompt);
        parts.push({ text: finalPrompt });

        const result = await model.generateContent(parts);
        const response = result.response;

        // Check for media data in the response
        let mediaUrl: string | null = null;
        console.log('Gemini candidates:', response.candidates?.length);

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if ('inlineData' in part && part.inlineData?.mimeType?.startsWith('image/') && part.inlineData) {
                    console.log('Found image in response!');
                    mediaUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
            if (mediaUrl) break;
        }

        if (!mediaUrl) {
            const textResponse = response.text?.() || 'No response';
            return NextResponse.json({
                success: false,
                error: `Image generation failed. Response: ${textResponse.substring(0, 200)}`,
            });
        }

        return NextResponse.json({
            success: true,
            imageUrl: mediaUrl,
        });

    } catch (error) {
        console.error('Generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate content' },
            { status: 500 }
        );
    }
}
