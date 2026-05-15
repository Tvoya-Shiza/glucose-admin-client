'use client';

import { FileUploader } from '@/components/ui/file-uploader';

/**
 * QuestionImageUploader — thin compat wrapper around <FileUploader>.
 *
 * See cover-image-uploader.tsx for the unification rationale (Phase 5+).
 */
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
    return (
        <FileUploader
            kind='image'
            variant='thumb'
            previewSize='md'
            value={currentImageUrl}
            onChange={(url) => onUploaded(url)}
            onClear={onClear}
            disabled={disabled}
        />
    );
}
