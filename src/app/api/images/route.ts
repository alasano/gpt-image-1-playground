import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { AzureOpenAI, OpenAI } from 'openai';
import path from 'path';

/**
 * Creates an OpenAI client, using AzureOpenAI if AZURE_OPENAI_API_BASE_URL is configured,
 * otherwise falls back to the standard OpenAI client.
 */
function createOpenAIClient(): OpenAI | AzureOpenAI {
    const azureBaseUrl = process.env.AZURE_OPENAI_API_BASE_URL;
    
    if (azureBaseUrl) {
        console.log('Using Azure OpenAI client');
        return new AzureOpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
            baseURL: azureBaseUrl,
            apiVersion: process.env.AZURE_OPENAI_APIVERSION || '2025-04-01-preview',
        });
    } else {
        console.log('Using standard OpenAI client');
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_API_BASE_URL
        });
    }
}

// OpenAI client will be created when needed in the POST function

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png'; // default fallback
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');

    // Check for required API key based on configuration
    const azureBaseUrl = process.env.AZURE_OPENAI_API_BASE_URL;
    const hasRequiredApiKey = azureBaseUrl 
        ? (process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY)
        : process.env.OPENAI_API_KEY;

    if (!hasRequiredApiKey) {
        const missingKey = azureBaseUrl ? 'AZURE_OPENAI_API_KEY or OPENAI_API_KEY' : 'OPENAI_API_KEY';
        console.error(`${missingKey} is not set.`);
        return NextResponse.json({ error: 'Server configuration error: API key not found.' }, { status: 500 });
    }
    try {
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const prompt = formData.get('prompt') as string | null;

        console.log(`Mode: ${mode}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        // Create OpenAI client at runtime
        const openai = createOpenAIClient();
        
        let result: OpenAI.Images.ImagesResponse;
        const model = process.env.MODEL_NAME || 'gpt-image-1';

        if (mode === 'generate') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as OpenAI.Images.ImageGenerateParams['size']) || '1024x1024';
            const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
            const output_format =
                (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
            const output_compression_str = formData.get('output_compression') as string | null;
            const background =
                (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
            const moderation =
                (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';

            const params: OpenAI.Images.ImageGenerateParams = {
                model,
                prompt,
                n: Math.max(1, Math.min(n || 1, 10)),
                size,
                quality,
                output_format,
                background,
                moderation
            };

            if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
                const compression = parseInt(output_compression_str, 10);
                if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                    params.output_compression = compression;
                }
            }

            console.log('Calling OpenAI generate with params:', params);
            result = await openai.images.generate(params);
        } else if (mode === 'edit') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as OpenAI.Images.ImageEditParams['size']) || 'auto';
            const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';

            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;

            const params: OpenAI.Images.ImageEditParams = {
                model,
                prompt,
                image: imageFiles[0], // OpenAI API expects a single File, not an array
                n: Math.max(1, Math.min(n || 1, 10)),
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality
            };

            
            
            if (maskFile) {
                params.mask = maskFile;
            }
            
            // If using Azure, ensure the API version is set (even when routing through OpenAI compliant endpoints)
            const AzureAPIVersion = process.env.AZURE_OPENAI_APIVERSION
            let options = {}
            if (AzureAPIVersion) {
                options = {"query": {"api-version": AzureAPIVersion}}
            }
            console.log('Calling OpenAI edit with params:', {
                ...params,
                image: imageFiles[0].name,
                mask: maskFile ? maskFile.name : 'N/A',
                options: options
            });
            result = await openai.images.edit(params, options);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await Promise.all(
            result.data.map(async (imageData, index) => {
                if (!imageData.b64_json) {
                    console.error(`Image data ${index} is missing b64_json.`);
                    throw new Error(`Image data at index ${index} is missing base64 data.`);
                }
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const timestamp = Date.now();

                const fileExtension = validateOutputFormat(formData.get('output_format'));
                const filename = `${timestamp}-${index}.${fileExtension}`;

                if (effectiveStorageMode === 'fs') {
                    const filepath = path.join(outputDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                } else {
                }

                const imageResult: { filename: string; b64_json: string; path?: string; output_format: string } = {
                    filename: filename,
                    b64_json: imageData.b64_json,
                    output_format: fileExtension
                };

                if (effectiveStorageMode === 'fs') {
                    imageResult.path = `/api/image/${filename}`;
                }

                return imageResult;
            })
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({ images: savedImagesData, usage: result.usage });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        let errorMessage = 'An unexpected error occurred.';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        } else if (typeof error === 'object' && error !== null) {
            if ('message' in error && typeof error.message === 'string') {
                errorMessage = error.message;
            }
            if ('status' in error && typeof error.status === 'number') {
                status = error.status;
            }
        }

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
