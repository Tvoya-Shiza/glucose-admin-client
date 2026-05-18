'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileUploader } from '@/components/ui/file-uploader';
import { updateCourse } from '@/lib/courses/api';
import type { CourseDetail } from '@/lib/courses/types';

/**
 * Self-contained cover uploader. Owns its updateCourse mutation so any
 * callsite (read-only overview, in-edit form) gets the same behavior:
 * upload → PATCH image_cover → prime detail cache + invalidate list.
 */
export interface CoverImageUploaderProps {
    courseId: number;
    currentCoverUrl: string;
    onUploaded?: (newUrl: string) => void;
}

export function CoverImageUploader({ courseId, currentCoverUrl, onUploaded }: CoverImageUploaderProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (newUrl: string) => updateCourse(courseId, { image_cover: newUrl }),
        onSuccess: (updated: CourseDetail) => {
            toast.success(t('upload_succeeded'));
            qc.setQueryData(['admin.courses.detail', courseId], updated);
            void qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
            void qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            onUploaded?.(updated.image_cover);
        },
        onError: () => {
            toast.error(t('upload_failed'));
        },
    });

    return (
        <FileUploader
            kind='cover'
            variant='card'
            previewSize='md'
            value={currentCoverUrl}
            onChange={(url) => mutation.mutate(url)}
            pickFromLibrary
        />
    );
}
