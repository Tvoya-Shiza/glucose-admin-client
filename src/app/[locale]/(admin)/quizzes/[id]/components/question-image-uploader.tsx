'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { requestUploadToken, uploadFileDirect } from '@/lib/courses/upload-client';
import type { UploadContentType } from '@/lib/courses/types';

/**
 * QuestionImageUploader — QZ-03 question.image attachment (Phase 6 Plan 05).
 *
 * Direct reuse of Phase 5's BFF-bypass upload pattern (CONTEXT D-13). Two-step:
 *   1. requestUploadToken({kind: 'image', size, content_type}) goes through the
 *      BFF proxy with the admin Bearer cookie — admin-api signs a 5-minute
 *      single-use JWT scoped to this file.
 *   2. uploadFileDirect goes browser → admin-api directly with X-Upload-Token,
 *      avoiding Next.js Route Handlers serializing MBs of binary through Node.js
 *      memory.
 *
 * The upload audit row tags the file as 'courses.upload.file' / 'file' (existing
 * Phase 5 audit) — accepted that the audit doesn't carry quiz_id; downstream
 * Phase 10 audit search bridges via timestamp + actor_id (per Plan 05 plan body).
 *
 * Caller persists via UpsertQuestionDto.image — the image URL is part of the
 * question payload, not a separate endpoint call.
 */
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches admin-api KIND_MAX_BYTES.image
const ALLOWED_MIMES: readonly UploadContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface QuestionImageUploaderProps {
    currentImageUrl: string | null;
    onUploaded: (newUrl: string) => void;
    onClear?: () => void;
    disabled?: boolean;
}

export function QuestionImageUploader({
    currentImageUrl,
    onUploaded,
    onClear,
    disabled,
}: QuestionImageUploaderProps) {
    const t = useTranslations('admin.courses');
    const tQz = useTranslations('admin.quizzes');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleChooseFile = () => {
        inputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (inputRef.current) inputRef.current.value = '';
        if (!file) return;

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
                kind: 'image',
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
    };

    return (
        <div className='flex items-start gap-3'>
            <div className='bg-muted text-muted-foreground flex h-20 w-32 items-center justify-center overflow-hidden rounded border text-xs'>
                {currentImageUrl && currentImageUrl.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentImageUrl} alt='' className='h-full w-full object-cover' />
                ) : (
                    <span>{tQz('q_image_label')}</span>
                )}
            </div>
            <div className='flex flex-col gap-2'>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={handleChooseFile}
                        disabled={uploading || disabled}
                        type='button'
                    >
                        {uploading ? t('upload_uploading') : t('upload_choose_file')}
                    </Button>
                    {currentImageUrl && onClear ? (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={onClear}
                            disabled={uploading || disabled}
                            type='button'
                        >
                            {tQz('delete')}
                        </Button>
                    ) : null}
                </div>
                {uploading ? (
                    <div className='w-40 space-y-1'>
                        <div className='bg-muted h-1.5 w-full overflow-hidden rounded'>
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
