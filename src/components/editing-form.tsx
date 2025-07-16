'use client';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
    Eraser,
    Loader2,
    Lock,
    LockOpen,
    RectangleHorizontal,
    RectangleVertical,
    Save,
    ScanEye,
    Sparkles,
    Square,
    Tally1,
    Tally2,
    Tally3,
    Upload,
    UploadCloud,
    X
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

export type EditingFormData = {
    prompt: string;
    n: number;
    size: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
    quality: 'low' | 'medium' | 'high' | 'auto';
    imageFiles: File[];
    maskFile: File | null;
};

type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    isLoading: boolean;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
    editPrompt: string;
    setEditPrompt: React.Dispatch<React.SetStateAction<string>>;
    editN: number[];
    setEditN: React.Dispatch<React.SetStateAction<number[]>>;
    editSize: EditingFormData['size'];
    setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
    editQuality: EditingFormData['quality'];
    setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
    editBrushSize: number[];
    setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
    editShowMaskEditor: boolean;
    setEditShowMaskEditor: React.Dispatch<React.SetStateAction<boolean>>;
    editGeneratedMaskFile: File | null;
    setEditGeneratedMaskFile: React.Dispatch<React.SetStateAction<File | null>>;
    editIsMaskSaved: boolean;
    setEditIsMaskSaved: React.Dispatch<React.SetStateAction<boolean>>;
    editOriginalImageSize: { width: number; height: number } | null;
    setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
    editDrawnPoints: DrawnPoint[];
    setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
    editMaskPreviewUrl: string | null;
    setEditMaskPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
};

const RadioItemWithIcon = ({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) => (
    <div className='flex items-center space-x-2'>
        <RadioGroupItem
            value={value}
            id={id}
            className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
        />
        <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
            <Icon className='h-5 w-5 text-white/60' />
            {label}
        </Label>
    </div>
);

export function EditingForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    imageFiles,
    sourceImagePreviewUrls,
    setImageFiles,
    setSourceImagePreviewUrls,
    editPrompt,
    setEditPrompt,
    editN,
    setEditN,
    editSize,
    setEditSize,
    editQuality,
    setEditQuality,
    editBrushSize,
    setEditBrushSize,
    editShowMaskEditor,
    setEditShowMaskEditor,
    editGeneratedMaskFile,
    setEditGeneratedMaskFile,
    editIsMaskSaved,
    setEditIsMaskSaved,
    editOriginalImageSize,
    setEditOriginalImageSize,
    editDrawnPoints,
    setEditDrawnPoints,
    editMaskPreviewUrl,
    setEditMaskPreviewUrl
}: EditingFormProps) {
    const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const visualFeedbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const isDrawing = React.useRef(false);
    const lastPos = React.useRef<{ x: number; y: number } | null>(null);
    const maskInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (editOriginalImageSize) {
            if (!visualFeedbackCanvasRef.current) {
                visualFeedbackCanvasRef.current = document.createElement('canvas');
            }
            visualFeedbackCanvasRef.current.width = editOriginalImageSize.width;
            visualFeedbackCanvasRef.current.height = editOriginalImageSize.height;
        }
    }, [editOriginalImageSize]);

    React.useEffect(() => {
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditOriginalImageSize(null);
        setFirstImagePreviewUrl(null);
        setEditDrawnPoints([]);
        setEditMaskPreviewUrl(null);

        if (imageFiles.length > 0 && sourceImagePreviewUrls.length > 0) {
            const img = new window.Image();
            img.onload = () => {
                setEditOriginalImageSize({ width: img.width, height: img.height });
            };
            img.src = sourceImagePreviewUrls[0];
            setFirstImagePreviewUrl(sourceImagePreviewUrls[0]);
        } else {
            setEditShowMaskEditor(false);
        }
    }, [
        imageFiles,
        sourceImagePreviewUrls,
        setEditGeneratedMaskFile,
        setEditIsMaskSaved,
        setEditOriginalImageSize,
        setEditDrawnPoints,
        setEditMaskPreviewUrl,
        setEditShowMaskEditor
    ]);

    React.useEffect(() => {
        const displayCtx = canvasRef.current?.getContext('2d');
        const displayCanvas = canvasRef.current;
        const feedbackCanvas = visualFeedbackCanvasRef.current;

        if (!displayCtx || !displayCanvas || !feedbackCanvas || !editOriginalImageSize) return;

        const feedbackCtx = feedbackCanvas.getContext('2d');
        if (!feedbackCtx) return;

        feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
        feedbackCtx.fillStyle = 'red';
        editDrawnPoints.forEach((point) => {
            feedbackCtx.beginPath();
            feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            feedbackCtx.fill();
        });

        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.save();
        displayCtx.globalAlpha = 0.5;
        displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.restore();
    }, [editDrawnPoints, editOriginalImageSize]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const addPoint = (x: number, y: number) => {
        setEditDrawnPoints((prevPoints) => [...prevPoints, { x, y, size: editBrushSize[0] }]);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const currentPos = getMousePos(e);
        if (!currentPos) return;
        lastPos.current = currentPos;
        addPoint(currentPos.x, currentPos.y);
    };

    const drawLine = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const currentPos = getMousePos(e);
        if (!currentPos || !lastPos.current) return;

        const dist = Math.hypot(currentPos.x - lastPos.current.x, currentPos.y - lastPos.current.y);
        const angle = Math.atan2(currentPos.y - lastPos.current.y, currentPos.x - lastPos.current.x);
        const step = Math.max(1, editBrushSize[0] / 4);

        for (let i = step; i < dist; i += step) {
            const x = lastPos.current.x + Math.cos(angle) * i;
            const y = lastPos.current.y + Math.sin(angle) * i;
            addPoint(x, y);
        }
        addPoint(currentPos.x, currentPos.y);

        lastPos.current = currentPos;
    };

    const drawMaskStroke = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const handleClearMask = () => {
        setEditDrawnPoints([]);
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const generateAndSaveMask = () => {
        if (!editOriginalImageSize || editDrawnPoints.length === 0) {
            setEditGeneratedMaskFile(null);
            setEditIsMaskSaved(false);
            setEditMaskPreviewUrl(null);
            return;
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = editOriginalImageSize.width;
        offscreenCanvas.height = editOriginalImageSize.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        if (!offscreenCtx) return;

        offscreenCtx.fillStyle = '#000000';
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.globalCompositeOperation = 'destination-out';
        editDrawnPoints.forEach((point) => {
            drawMaskStroke(offscreenCtx, point.x, point.y, point.size);
        });

        try {
            const dataUrl = offscreenCanvas.toDataURL('image/png');
            setEditMaskPreviewUrl(dataUrl);
        } catch (e) {
            console.error('Error generating mask preview data URL:', e);
            setEditMaskPreviewUrl(null);
        }

        offscreenCanvas.toBlob((blob) => {
            if (blob) {
                const maskFile = new File([blob], 'generated-mask.png', { type: 'image/png' });
                setEditGeneratedMaskFile(maskFile);
                setEditIsMaskSaved(true);
                console.log('Mask generated and saved to state:', maskFile);
            } else {
                console.error('Failed to generate mask blob.');
                setEditIsMaskSaved(false);
                setEditMaskPreviewUrl(null);
            }
        }, 'image/png');
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0]; // Only take the first file

            // Clean up previous preview URLs
            sourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setImageFiles([file]); // Replace with single file

            const reader = new FileReader();
            reader.onloadend = () => {
                setSourceImagePreviewUrls([reader.result as string]);
            };
            reader.onerror = (error) => {
                console.error('Error reading image file:', error);
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImageFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
        setSourceImagePreviewUrls((prevUrls) => prevUrls.filter((_, index) => index !== indexToRemove));
    };

    const handleMaskFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editOriginalImageSize) {
            event.target.value = '';
            return;
        }

        if (file.type !== 'image/png') {
            alert('Invalid file type. Please upload a PNG file for the mask.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
                alert(
                    `Mask dimensions (${img.width}x${img.height}) must match the source image dimensions (${editOriginalImageSize.width}x${editOriginalImageSize.height}).`
                );
                URL.revokeObjectURL(objectUrl);
                event.target.value = '';
                return;
            }

            setEditGeneratedMaskFile(file);
            setEditIsMaskSaved(true);
            setEditDrawnPoints([]);

            reader.onloadend = () => {
                setEditMaskPreviewUrl(reader.result as string);
                URL.revokeObjectURL(objectUrl);
            };
            reader.onerror = () => {
                console.error('Error reading mask file for preview.');
                setEditMaskPreviewUrl(null);
                URL.revokeObjectURL(objectUrl);
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        };

        img.onerror = () => {
            alert('Failed to load the uploaded mask image to check dimensions.');
            URL.revokeObjectURL(objectUrl);
            event.target.value = '';
        };

        img.src = objectUrl;
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (imageFiles.length === 0) {
            alert('Please select at least one image to edit.');
            return;
        }
        if (editDrawnPoints.length > 0 && !editGeneratedMaskFile && !editIsMaskSaved) {
            alert('Please save the mask you have drawn before submitting.');
            return;
        }

        const formData: EditingFormData = {
            prompt: editPrompt,
            n: editN[0],
            size: editSize,
            quality: editQuality,
            imageFiles: imageFiles,
            maskFile: editGeneratedMaskFile
        };
        onSubmit(formData);
    };

    const displayFileNames = (files: File[]) => {
        if (files.length === 0) return 'No file selected.';
        if (files.length === 1) return files[0].name;
        return `${files.length} files selected`;
    };

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Edit Image</CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='ml-2 text-white/60 hover:text-white'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='mt-1 text-white/60'>Modify an image using gpt-image-1.</CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-prompt' className='text-white'>
                            Prompt
                        </Label>
                        <Textarea
                            id='edit-prompt'
                            placeholder='e.g., Add a party hat to the main subject'
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label className='text-white'>Source Image</Label>
                        <Label
                            htmlFor='image-files-input'
                            className='flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-white/20 bg-black px-3 py-2 text-sm transition-colors hover:bg-white/5'>
                            <span className='truncate pr-2 text-white/60'>{displayFileNames(imageFiles)}</span>
                            <span className='flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20'>
                                <Upload className='h-3 w-3' /> Browse...
                            </span>
                        </Label>
                        <Input
                            id='image-files-input'
                            type='file'
                            accept='image/png, image/jpeg, image/webp'
                            onChange={handleImageFileChange}
                            disabled={isLoading}
                            className='sr-only'
                        />
                        {sourceImagePreviewUrls.length > 0 && (
                            <div className='flex space-x-2 overflow-x-auto pt-2'>
                                {sourceImagePreviewUrls.map((url, index) => (
                                    <div key={url} className='relative shrink-0'>
                                        <Image
                                            src={url}
                                            alt={`Source preview ${index + 1}`}
                                            width={80}
                                            height={80}
                                            className='rounded border border-white/10 object-cover'
                                            unoptimized
                                        />
                                        <Button
                                            type='button'
                                            variant='destructive'
                                            size='icon'
                                            className='absolute top-0 right-0 h-5 w-5 translate-x-1/3 -translate-y-1/3 transform rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700'
                                            onClick={() => handleRemoveImage(index)}
                                            aria-label={`Remove image ${index + 1}`}>
                                            <X className='h-3 w-3' />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Mask</Label>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setEditShowMaskEditor(!editShowMaskEditor)}
                            disabled={isLoading || !editOriginalImageSize}
                            className='w-full justify-start border-white/20 px-3 text-white/80 hover:bg-white/10 hover:text-white'>
                            {editShowMaskEditor
                                ? 'Close Mask Editor'
                                : editGeneratedMaskFile
                                  ? 'Edit Saved Mask'
                                  : 'Create Mask'}
                            {editIsMaskSaved && !editShowMaskEditor && (
                                <span className='ml-auto text-xs text-green-400'>(Saved)</span>
                            )}
                            <ScanEye className='mt-0.5' />
                        </Button>

                        {editShowMaskEditor && firstImagePreviewUrl && editOriginalImageSize && (
                            <div className='space-y-3 rounded-md border border-white/20 bg-black p-3'>
                                <p className='text-xs text-white/60'>
                                    Draw on the image below to mark areas for editing (drawn areas become transparent in
                                    the mask).
                                </p>
                                <div
                                    className='relative mx-auto w-full overflow-hidden rounded border border-white/10'
                                    style={{
                                        maxWidth: `min(100%, ${editOriginalImageSize.width}px)`,
                                        aspectRatio: `${editOriginalImageSize.width} / ${editOriginalImageSize.height}`
                                    }}>
                                    <Image
                                        src={firstImagePreviewUrl}
                                        alt='Image preview for masking'
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='block h-auto w-full'
                                        unoptimized
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='absolute top-0 left-0 h-full w-full cursor-crosshair'
                                        onMouseDown={startDrawing}
                                        onMouseMove={drawLine}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={drawLine}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-4 pt-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='brush-size-slider' className='text-sm text-white'>
                                            Brush Size: {editBrushSize[0]}px
                                        </Label>
                                        <Slider
                                            id='brush-size-slider'
                                            min={5}
                                            max={100}
                                            step={1}
                                            value={editBrushSize}
                                            onValueChange={setEditBrushSize}
                                            disabled={isLoading}
                                            className='mt-1 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                        />
                                    </div>
                                </div>
                                <div className='flex items-center justify-between gap-2 pt-3'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => maskInputRef.current?.click()}
                                        disabled={isLoading || !editOriginalImageSize}
                                        className='mr-auto border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                        <UploadCloud className='mr-1.5 h-4 w-4' /> Upload Mask
                                    </Button>
                                    <Input
                                        ref={maskInputRef}
                                        id='mask-file-input'
                                        type='file'
                                        accept='image/png'
                                        onChange={handleMaskFileChange}
                                        className='sr-only'
                                    />
                                    <div className='flex gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={handleClearMask}
                                            disabled={isLoading}
                                            className='border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                            <Eraser className='mr-1.5 h-4 w-4' /> Clear
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='default'
                                            size='sm'
                                            onClick={generateAndSaveMask}
                                            disabled={isLoading || editDrawnPoints.length === 0}
                                            className='bg-white text-black hover:bg-white/90 disabled:opacity-50'>
                                            <Save className='mr-1.5 h-4 w-4' /> Save Mask
                                        </Button>
                                    </div>
                                </div>
                                {editMaskPreviewUrl && (
                                    <div className='mt-3 border-t border-white/10 pt-3 text-center'>
                                        <Label className='mb-1.5 block text-sm text-white'>
                                            Generated Mask Preview:
                                        </Label>
                                        <div className='inline-block rounded border border-gray-300 bg-white p-1'>
                                            <Image
                                                src={editMaskPreviewUrl}
                                                alt='Generated mask preview'
                                                width={0}
                                                height={134}
                                                className='block max-w-full'
                                                style={{ width: 'auto', height: '134px' }}
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}
                                {editIsMaskSaved && !editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-yellow-400'>
                                        Generating mask preview...
                                    </p>
                                )}
                                {editIsMaskSaved && editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-green-400'>Mask saved successfully!</p>
                                )}
                            </div>
                        )}
                        {!editShowMaskEditor && editGeneratedMaskFile && (
                            <p className='pt-1 text-xs text-green-400'>Mask applied: {editGeneratedMaskFile.name}</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Size</Label>
                        <RadioGroup
                            value={editSize}
                            onValueChange={(value) => setEditSize(value as EditingFormData['size'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='edit-size-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='1024x1024' id='edit-size-square' label='Square' Icon={Square} />
                            <RadioItemWithIcon
                                value='1536x1024'
                                id='edit-size-landscape'
                                label='Landscape'
                                Icon={RectangleHorizontal}
                            />
                            <RadioItemWithIcon
                                value='1024x1536'
                                id='edit-size-portrait'
                                label='Portrait'
                                Icon={RectangleVertical}
                            />
                        </RadioGroup>
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>Quality</Label>
                        <RadioGroup
                            value={editQuality}
                            onValueChange={(value) => setEditQuality(value as EditingFormData['quality'])}
                            disabled={isLoading}
                            className='flex flex-wrap gap-x-5 gap-y-3'>
                            <RadioItemWithIcon value='auto' id='edit-quality-auto' label='Auto' Icon={Sparkles} />
                            <RadioItemWithIcon value='low' id='edit-quality-low' label='Low' Icon={Tally1} />
                            <RadioItemWithIcon value='medium' id='edit-quality-medium' label='Medium' Icon={Tally2} />
                            <RadioItemWithIcon value='high' id='edit-quality-high' label='High' Icon={Tally3} />
                        </RadioGroup>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='edit-n-slider' className='text-white'>
                            Number of Images: {editN[0]}
                        </Label>
                        <Slider
                            id='edit-n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={editN}
                            onValueChange={setEditN}
                            disabled={isLoading}
                            className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                        />
                    </div>
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !editPrompt || imageFiles.length === 0}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                        {isLoading ? 'Editing...' : 'Edit Image'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
