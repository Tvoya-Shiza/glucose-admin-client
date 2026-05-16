'use client';

import { FileUploader } from '@/components/ui/file-uploader';

/**
 * CoverImageUploader — thin compat wrapper around <FileUploader>.
 *
 * Pre-unification, this owned the BFF-bypass two-step upload directly. The
 * extraction is now in src/lib/uploads + the shared UI lives in <FileUploader>.
 * Keeping this wrapper preserves the prop signature for overview-tab.tsx and
 * edit-course-form.tsx without forcing them to know about the new component.
 */
export interface CoverImageUploaderProps {
    courseId: number;
    currentCoverUrl: string;
    onUploaded: (newUrl: string) => void;
}

export function CoverImageUploader({ currentCoverUrl, onUploaded }: CoverImageUploaderProps) {
    return (
        <FileUploader
            kind='cover'
            variant='card'
            previewSize='md'
            value={currentCoverUrl}
            onChange={(url) => onUploaded(url)}
            pickFromLibrary
        />
    );
}
