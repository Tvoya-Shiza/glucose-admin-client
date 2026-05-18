'use client';

import { FileUploader } from '@/components/ui/file-uploader';

/**
 * AnswerImageUploader — thin compat wrapper around <FileUploader>.
 *
 * See cover-image-uploader.tsx for the unification rationale (Phase 5+).
 * Uses previewSize='sm' to fit answer-row layout (12×12).
 */
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
    return (
        <FileUploader
            kind='image'
            variant='thumb'
            previewSize='sm'
            value={currentImageUrl}
            onChange={(url) => onUploaded(url)}
            onClear={onClear}
            disabled={disabled}
            pickFromLibrary
        />
    );
}
