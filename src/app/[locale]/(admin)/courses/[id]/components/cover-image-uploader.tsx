'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { requestUploadToken, uploadFileDirect } from '@/lib/courses/upload-client';
import type { UploadContentType } from '@/lib/courses/types';

/**
 * CoverImageUploader — CRS-05 (Phase 5 Plan 04). Replaces the Plan 03 stub.
 *
 * Two-step BFF-bypass upload (CONTEXT D-13):
 *   1. requestUploadToken(...) goes through the BFF proxy with the admin
 *      Bearer cookie. admin-api signs a 5-minute JWT scoped to this file.
 *   2. uploadFileDirect(...) sends the file BROWSER → admin-api directly
 *      with X-Upload-Token. NO admin Bearer; the upload token IS the credential.
 *
 * Client-side validation mirrors the server caps so the user sees the error
 * before paying for the round-trip:
 *   - kind = 'cover' → max 10 MB
 *   - MIME whitelist: image/jpeg, image/png, image/webp
 *
 * On success, calls onUploaded(file_url) — the parent (OverviewTab) is
 * responsible for persisting via updateCourse({ image_cover: file_url }).
 */
export interface CoverImageUploaderProps {
    courseId: number;
    currentCoverUrl: string;
    onUploaded: (newUrl: string) => void;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches admin-api KIND_MAX_BYTES.cover
const ALLOWED_MIMES: readonly UploadContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

export function CoverImageUploader({ courseId, currentCoverUrl, onUploaded }: CoverImageUploaderProps) {
    const t = useTranslations('admin.courses');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleChooseFile = () => {
        inputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Reset the input so picking the same file again re-triggers onChange.
        if (inputRef.current) inputRef.current.value = '';
        if (!file) return;

        // Client-side gating — server enforces the same caps.
        if (file.size > MAX_BYTES) {
            toast.error(t('upload_file_too_large'));
            return;
        }
        if (!ALLOWED_MIMES.includes(file.type as UploadContentType)) {
            toast.error(t('upload_mime_not_allowed'));
            return;
        }

        setUploading(true);
        setProgress(0);
        try {
            const tokenRes = await requestUploadToken({
                kind: 'cover',
                size: file.size,
                content_type: file.type as UploadContentType,
            });
            const result = await uploadFileDirect(
                tokenRes.upload_url,
                tokenRes.token,
                file,
                (pct) => setProgress(pct),
            );
            onUploaded(result.file_url);
            toast.success(t('upload_succeeded'));
        } catch (err) {
            const msg = (err as Error)?.message ?? '';
            // Map known server error keys to localized strings; fall back to generic.
            if (msg.includes('upload.token_already_used')) {
                toast.error(t('upload_already_used'));
            } else if (msg.includes('upload.token_invalid') || msg.includes('upload.token_missing')) {
                toast.error(t('upload_token_expired'));
            } else if (msg.includes('upload.size_exceeds') || msg.includes('upload.content_type')) {
                toast.error(t('upload_file_too_large'));
            } else {
                toast.error(t('upload_failed'));
            }
        } finally {
            setUploading(false);
            setProgress(0);
        }
        // courseId reserved for future progress-tracking analytics — explicit reference
        // keeps the prop in the contract.
        void courseId;
    };

    return (
        <div className='flex items-start gap-4'>
            <div className='bg-muted text-muted-foreground flex h-24 w-40 items-center justify-center overflow-hidden rounded border text-xs'>
                {currentCoverUrl && currentCoverUrl.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentCoverUrl} alt='' className='h-full w-full object-cover' />
                ) : (
                    <span>{t('cover_label')}</span>
                )}
            </div>
            <div className='flex flex-col gap-2'>
                <Button variant='outline' onClick={handleChooseFile} disabled={uploading} type='button'>
                    {uploading ? t('upload_uploading') : t('upload_choose_file')}
                </Button>
                {uploading ? (
                    <div className='w-48 space-y-1'>
                        <div className='bg-muted h-2 w-full overflow-hidden rounded'>
                            <div
                                className='bg-primary h-full transition-[width] duration-150'
                                style={{ width: `${progress}%` }}
                                role='progressbar'
                                aria-valuenow={progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            />
                        </div>
                        <div className='text-muted-foreground text-xs'>
                            {t('upload_progress', { pct: progress })}
                        </div>
                    </div>
                ) : null}
                <input
                    ref={inputRef}
                    type='file'
                    accept={ALLOWED_MIMES.join(',')}
                    className='hidden'
                    onChange={handleFileChange}
                    aria-hidden
                />
            </div>
        </div>
    );
}
