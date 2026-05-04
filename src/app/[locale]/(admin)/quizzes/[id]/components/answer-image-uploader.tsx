'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { requestUploadToken, uploadFileDirect } from '@/lib/courses/upload-client';
import type { UploadContentType } from '@/lib/courses/types';

/**
 * AnswerImageUploader — QZ-03 answer.image attachment (Phase 6 Plan 05).
 *
 * Identical strategy to QuestionImageUploader: BFF-bypass two-step upload via
 * Phase 5 upload-client.ts. Compact size styling because answer rows are
 * narrower than question editor.
 *
 * Image-only (no video for answer rows in v1 per Plan 05 deferred-items: video
 * for answers is v1.5).
 */
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES: readonly UploadContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface AnswerImageUploaderProps {
    currentImageUrl: string | null;
    onUploaded: (newUrl: string) => void;
    onClear?: () => void;
    disabled?: boolean;
}

export function AnswerImageUploader({
    currentImageUrl,
    onUploaded,
    onClear,
    disabled,
}: AnswerImageUploaderProps) {
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
        <div className='flex items-center gap-2'>
            <div className='bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border text-xs'>
                {currentImageUrl && currentImageUrl.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentImageUrl} alt='' className='h-full w-full object-cover' />
                ) : (
                    <span>—</span>
                )}
            </div>
            <Button
                variant='ghost'
                size='sm'
                onClick={handleChooseFile}
                disabled={uploading || disabled}
                type='button'
            >
                {uploading
                    ? `${progress}%`
                    : currentImageUrl
                      ? t('upload_choose_file')
                      : tQz('a_image_label')}
            </Button>
            {currentImageUrl && onClear ? (
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={onClear}
                    disabled={uploading || disabled}
                    type='button'
                >
                    ×
                </Button>
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
    );
}
