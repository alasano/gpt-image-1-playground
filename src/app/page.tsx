'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateApiCost, type CostDetails } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 1;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

export default function HomePage() {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const [blobUrlCache, setBlobUrlCache] = React.useState<Record<string, string>>({});
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('auto');
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            if (blobUrlCache[filename]) {
                return blobUrlCache[filename];
            }

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);

                return url;
            }

            return undefined;
        },
        [allDbImages, blobUrlCache]
    );

    React.useEffect(() => {
        return () => {
            console.log('Revoking blob URLs:', Object.keys(blobUrlCache).length);
            Object.values(blobUrlCache).forEach((url) => {
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [blobUrlCache]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('openaiImageHistory');
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory);
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem('openaiImageHistory');
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('openaiImageHistory');
        }
        setIsInitialLoad(false);
    }, []);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            const items = event.clipboardData.items;
            let imageFound = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        imageFound = true;

                        // Clean up previous preview URLs
                        editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles([file]); // Replace with single file
                        setEditSourceImagePreviewUrls([previewUrl]); // Replace with single preview

                        console.log('Pasted image replaced existing:', file.name);

                        break;
                    }
                }
            }
            if (!imageFound) {
                console.log('Paste event did not contain a recognized image file.');
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editSourceImagePreviewUrls]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError('Password cannot be empty.');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                console.log('Retrying API call after password save...');
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError('Password is required. Please configure the password by clicking the lock icon.');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }
        apiFormData.append('mode', mode);

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            apiFormData.append('size', genSize);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
        } else {
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            apiFormData.append('size', editSize);
            apiFormData.append('quality', editQuality);

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

        console.log('Sending request to /api/images with mode:', mode);

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('Unauthorized: Invalid or missing password. Please try again.');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);

                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            console.log('API Response:', result);

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;
                console.log(`API call successful. Duration: ${durationMs}ms`);

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    historyQuality = genQuality;
                    historyBackground = genBackground;
                    historyModeration = genModeration;
                    historyOutputFormat = genOutputFormat;
                    historyPrompt = genPrompt;
                } else {
                    historyQuality = editQuality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = editPrompt;
                }

                const costDetails = calculateApiCost(result.usage);

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
                    storageModeUsed: effectiveStorageModeClient,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    mode: mode,
                    costDetails: costDetails
                };

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    console.log('Processing images for IndexedDB storage...');
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });
                                console.log(`Saved ${img.filename} to IndexedDB with type ${actualMimeType}.`);

                                const blobUrl = URL.createObjectURL(blob);
                                setBlobUrlCache((prev) => ({ ...prev, [img.filename]: blobUrl }));

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
                setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            } else {
                setLatestImageBatch(null);
                throw new Error('API response did not contain valid image data or filenames.');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    };

    const handleHistorySelect = (item: HistoryMetadata) => {
        console.log(
            `Selecting history item from ${new Date(item.timestamp).toISOString()}, stored via: ${item.storageModeUsed}`
        );
        const originalStorageMode = item.storageModeUsed || 'fs';

        const selectedBatchPromises = item.images.map(async (imgInfo) => {
            let path: string | undefined;
            if (originalStorageMode === 'indexeddb') {
                path = getImageSrc(imgInfo.filename);
            } else {
                path = `/api/image/${imgInfo.filename}`;
            }

            if (path) {
                return { path, filename: imgInfo.filename };
            } else {
                console.warn(
                    `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                );
                setError(`Image ${imgInfo.filename} could not be loaded.`);
                return null;
            }
        });

        Promise.all(selectedBatchPromises).then((resolvedBatch) => {
            const validImages = resolvedBatch.filter(Boolean) as { path: string; filename: string }[];

            if (validImages.length !== item.images.length && !error) {
                setError(
                    'Some images from this history entry could not be loaded (they might have been cleared or are missing).'
                );
            } else if (validImages.length === item.images.length) {
                setError(null);
            }

            setLatestImageBatch(validImages.length > 0 ? validImages : null);
            setImageOutputView(validImages.length > 1 ? 'grid' : 0);
        });
    };

    const handleClearHistory = async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? 'Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone.'
                : 'Are you sure you want to clear the entire image history? This cannot be undone.';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');
                console.log('Cleared history metadata from localStorage.');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    console.log('Cleared images from IndexedDB.');

                    setBlobUrlCache({});
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    };

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            console.log(`Image ${filename} already in edit list.`);
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
            setIsSendingToEdit(false);
            return;
        }

        console.log(`Sending image ${filename} to edit...`);

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            if (effectiveStorageModeClient === 'indexeddb') {
                console.log(`Fetching blob ${filename} from IndexedDB...`);

                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                    console.log(`Found blob ${filename} in IndexedDB.`);
                } else {
                    throw new Error(`Image ${filename} not found in local database.`);
                }
            } else {
                console.log(`Fetching image ${filename} from API...`);
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
                console.log(`Fetched image ${filename} from API.`);
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }

            console.log(`Successfully set ${filename} in edit form.`);
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to send image to edit form.';
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = async (item: HistoryMetadata) => {
        if (!item) return;
        console.log(`Executing delete for history item timestamp: ${item.timestamp}`);
        setError(null); // Clear previous errors

        const { images: imagesInEntry, storageModeUsed, timestamp } = item;
        const filenamesToDelete = imagesInEntry.map((img) => img.filename);

        try {
            if (storageModeUsed === 'indexeddb') {
                console.log('Deleting from IndexedDB:', filenamesToDelete);
                await db.images.where('filename').anyOf(filenamesToDelete).delete();
                setBlobUrlCache((prevCache) => {
                    const newCache = { ...prevCache };
                    filenamesToDelete.forEach((fn) => delete newCache[fn]);
                    return newCache;
                });
                console.log('Successfully deleted from IndexedDB and cleared blob cache.');
            } else if (storageModeUsed === 'fs') {
                console.log('Requesting deletion from filesystem via API:', filenamesToDelete);
                const apiPayload: { filenames: string[]; passwordHash?: string } = { filenames: filenamesToDelete };
                if (isPasswordRequiredByBackend && clientPasswordHash) {
                    apiPayload.passwordHash = clientPasswordHash;
                }

                const response = await fetch('/api/image-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload)
                });

                const result = await response.json();
                if (!response.ok) {
                    console.error('API deletion error:', result);
                    throw new Error(result.error || `API deletion failed with status ${response.status}`);
                }
                console.log('API deletion successful:', result);
            }

            setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
            if (latestImageBatch && latestImageBatch.some((img) => filenamesToDelete.includes(img.filename))) {
                setLatestImageBatch(null); // Clear current view if it contained deleted images
            }
        } catch (e: unknown) {
            console.error('Error during item deletion:', e);
            setError(e instanceof Error ? e.message : 'An unexpected error occurred during deletion.');
        } finally {
            setItemToDeleteConfirm(null); // Always close dialog
        }
    };

    const handleRequestDeleteItem = (item: HistoryMetadata) => {
        if (!skipDeleteConfirmation) {
            setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
            setItemToDeleteConfirm(item);
        } else {
            executeDeleteItem(item);
        }
    };

    const handleConfirmDeletion = () => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    };

    const handleCancelDeletion = () => {
        setItemToDeleteConfirm(null);
    };

    return (
        <main className='flex min-h-screen flex-col items-center bg-black p-4 text-white md:p-8 lg:p-12'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? 'Password Required' : 'Configure Password'}
                description={
                    passwordDialogContext === 'retry'
                        ? 'The server requires a password, or the previous one was incorrect. Please enter it to continue.'
                        : 'Set a password to use for API requests.'
                }
            />
            <div className='w-full max-w-7xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                            />
                        </div>
                    </div>
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='Generated image output'
                            isLoading={isLoading || isSendingToEdit}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
