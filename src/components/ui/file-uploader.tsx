'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileLibraryPicker } from '@/components/ui/file-library-picker';
import { cn } from '@/lib/utils';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import { acceptForKind, maxSizeMb } from '@/lib/uploads/constants';
import { useFileUpload } from '@/lib/uploads/use-file-upload';
import type { UploadContentType, UploadKind, UploaderMeta } from '@/lib/uploads/types';

/**
 * Unified file-upload UI for the admin panel. Wraps `useFileUpload` and renders
 * one of several layouts so all 8+ callsites (banner / blog / story / course
 * cover / course item / quiz question / quiz answer / Tiptap) share the same
 * progress, preview, and error semantics.
 *
 * Controlled component:
 *   - `value` is the current URL stored upstream (passed back as-is when not
 *     uploading).
 *   - `onChange` fires on upload success with `(url, meta)`.
 *   - `onClear` (optional) shows a × button next to the preview.
 *
 * Variants control layout only; the underlying state machine is identical.
 */

export type FileUploaderVariant = 'card' | 'inline' | 'thumb' | 'tiptap-trigger';
export type FileUploaderPreviewSize = 'sm' | 'md' | 'lg';

export interface FileUploaderProps {
    kind: UploadKind;
    value?: string | null;
    onChange: (url: string, meta: UploaderMeta) => void;
    onClear?: () => void;
    variant?: FileUploaderVariant;
    previewSize?: FileUploaderPreviewSize;
    label?: string;
    disabled?: boolean;
    /** Narrower-than-kind size cap (bytes). */
    maxSize?: number;
    /** Narrower-than-kind MIME whitelist. */
    accept?: ReadonlyArray<UploadContentType>;
    /** Extra Tailwind classes on the root element. */
    className?: string;
    /** Custom trigger label override (otherwise picks kind-aware default). */
    triggerLabel?: string;
    /** Show a "pick from library" button alongside the upload trigger. */
    pickFromLibrary?: boolean;
    /** Phase 10 — destination folder for new uploads and starting folder for the picker.
     *  null/undefined = root. */
    defaultFolderId?: number | null;
}

const PREVIEW_SIZE_CLASSES: Record<FileUploaderPreviewSize, string> = {
    sm: 'h-12 w-12',
    md: 'h-20 w-32',
    lg: 'h-32 w-52',
};

function defaultTriggerKey(kind: UploadKind, hasValue: boolean): string {
    if (kind === 'video') return hasValue ? 'replace_video' : 'choose_video';
    if (kind === 'cover') return hasValue ? 'replace_cover' : 'choose_cover';
    return hasValue ? 'replace_image' : 'choose_image';
}

export function FileUploader({
    kind,
    value,
    onChange,
    onClear,
    variant = 'card',
    previewSize = 'md',
    label,
    disabled = false,
    maxSize,
    accept,
    className,
    triggerLabel,
    pickFromLibrary = false,
    defaultFolderId,
}: FileUploaderProps) {
    const t = useTranslations('upload');
    const tFiles = useTranslations('files');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    const { state, progress, upload, reset } = useFileUpload({
        kind,
        maxSize,
        accept,
        folderId: defaultFolderId ?? null,
        onSuccess: (url, meta) => {
            onChange(url, meta);
            toast.success(t('succeeded'));
        },
        onError: (i18nKey) => {
            toast.error(t(stripNamespace(i18nKey)));
        },
    });

    const libraryButton = pickFromLibrary ? (
        <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setPickerOpen(true)}
            disabled={disabled || state === 'requesting' || state === 'uploading'}
        >
            {tFiles('title')}
        </Button>
    ) : null;

    const pickerDialog = pickFromLibrary ? (
        <FileLibraryPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            kind={kind}
            defaultFolderId={defaultFolderId ?? null}
            onPick={(url, meta) => onChange(url, meta)}
        />
    ) : null;

    // Reset hook state whenever the upstream value reflects a successful upload,
    // so a subsequent error doesn't show through a stale "done" pill.
    useEffect(() => {
        if (state === 'done' && value) {
            reset();
        }
    }, [state, value, reset]);

    const uploading = state === 'requesting' || state === 'uploading';
    const hasValue = !!value && value.length > 0;

    const handleChoose = () => {
        if (disabled || uploading) return;
        inputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (inputRef.current) inputRef.current.value = ''; // allow re-selecting same file
        if (file) upload(file);
    };

    const triggerCopy = triggerLabel ?? t(defaultTriggerKey(kind, hasValue));
    const acceptAttr = accept ? accept.join(',') : acceptForKind(kind);
    const sizeHint = t('size_hint', { mb: maxSize ? Math.round(maxSize / (1024 * 1024)) : maxSizeMb(kind) });

    const hiddenInput = (
        <input
            ref={inputRef}
            type='file'
            accept={acceptAttr}
            className='hidden'
            onChange={handleFileChange}
            aria-hidden
        />
    );

    if (variant === 'tiptap-trigger') {
        return (
            <>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={handleChoose}
                    disabled={disabled || uploading}
                    className={className}
                    aria-label={triggerCopy}
                    title={triggerCopy}
                >
                    {uploading ? t('uploading') : triggerCopy}
                </Button>
                {hiddenInput}
            </>
        );
    }

    if (variant === 'thumb') {
        return (
            <div className={cn('flex items-center gap-2', className)}>
                <PreviewBox value={value} kind={kind} sizeClass={PREVIEW_SIZE_CLASSES[previewSize]} />
                <div className='flex flex-col gap-1'>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={handleChoose}
                        disabled={disabled || uploading}
                    >
                        {uploading ? `${progress}%` : triggerCopy}
                    </Button>
                    {hasValue && onClear ? (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={onClear}
                            disabled={disabled || uploading}
                        >
                            {t('clear')}
                        </Button>
                    ) : null}
                </div>
                {hiddenInput}
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <div className={cn('flex flex-col gap-2', className)}>
                {label ? <span className='text-sm font-medium'>{label}</span> : null}
                <div className='flex items-start gap-3'>
                    {hasValue ? (
                        <PreviewBox value={value} kind={kind} sizeClass={PREVIEW_SIZE_CLASSES[previewSize]} />
                    ) : null}
                    <div className='flex flex-1 flex-col gap-2'>
                        <div className='flex items-center gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={handleChoose}
                                disabled={disabled || uploading}
                            >
                                {uploading ? t('uploading') : triggerCopy}
                            </Button>
                            {libraryButton}
                            {hasValue && onClear ? (
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={onClear}
                                    disabled={disabled || uploading}
                                >
                                    {t('clear')}
                                </Button>
                            ) : null}
                        </div>
                        {uploading ? <ProgressBar pct={progress} /> : null}
                        <div className='text-muted-foreground text-xs'>{sizeHint}</div>
                    </div>
                </div>
                {hiddenInput}
                {pickerDialog}
            </div>
        );
    }

    // variant === 'card' (default — large preview + button stack)
    return (
        <div className={cn('flex items-start gap-4', className)}>
            <PreviewBox value={value} kind={kind} sizeClass={PREVIEW_SIZE_CLASSES[previewSize]} />
            <div className='flex flex-col gap-2'>
                {label ? <span className='text-sm font-medium'>{label}</span> : null}
                <div className='flex items-center gap-2'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={handleChoose}
                        disabled={disabled || uploading}
                    >
                        {uploading ? t('uploading') : triggerCopy}
                    </Button>
                    {libraryButton}
                    {hasValue && onClear ? (
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={onClear}
                            disabled={disabled || uploading}
                        >
                            {t('clear')}
                        </Button>
                    ) : null}
                </div>
                {uploading ? <ProgressBar pct={progress} className='w-52' /> : null}
                <div className='text-muted-foreground text-xs'>{sizeHint}</div>
                {hiddenInput}
                {pickerDialog}
            </div>
        </div>
    );
}

function stripNamespace(key: string): string {
    return key.startsWith('upload.') ? key.slice('upload.'.length) : key;
}

function PreviewBox({
    value,
    kind,
    sizeClass,
}: {
    value: string | null | undefined;
    kind: UploadKind;
    sizeClass: string;
}) {
    const t = useTranslations('upload');
    if (!value || value.length === 0) {
        return (
            <div
                className={cn(
                    'bg-muted text-muted-foreground flex items-center justify-center overflow-hidden rounded border text-xs',
                    sizeClass,
                )}
            >
                <span>{t(`empty_${kind}`)}</span>
            </div>
        );
    }
    const src = resolveAssetUrl(value);
    if (kind === 'video') {
        return (
            <video
                src={src}
                className={cn('rounded border bg-black object-cover', sizeClass)}
                controls
                preload='metadata'
            />
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt=''
            className={cn('rounded border object-cover', sizeClass)}
        />
    );
}

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
    const t = useTranslations('upload');
    return (
        <div className={cn('space-y-1', className)}>
            <div className='bg-muted h-2 w-full overflow-hidden rounded'>
                <div
                    className='bg-primary h-full transition-[width] duration-150'
                    style={{ width: `${pct}%` }}
                    role='progressbar'
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>
            <div className='text-muted-foreground text-xs'>{t('progress', { pct })}</div>
        </div>
    );
}
