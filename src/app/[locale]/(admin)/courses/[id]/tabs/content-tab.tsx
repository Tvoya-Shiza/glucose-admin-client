'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCourse } from '@/lib/courses/api';
import { ChapterTreeEditor } from '../components/chapter-tree-editor';
import { UpsertChapterDialog } from '../components/upsert-chapter-dialog';

/**
 * Content tab — Plan 05 implementation (CRS-03 + CRS-04).
 *
 * Replaces the Plan 03 placeholder. Mounts ChapterTreeEditor (dnd-kit drag-drop
 * tree) + an "Add chapter" CTA wired to UpsertChapterDialog.
 *
 * The detail query is shared with course-detail-client.tsx via the cache key
 * `['admin.courses.detail', courseId]` — mutations inside ChapterTreeEditor /
 * UpsertChapterDialog / UpsertItemDialog all invalidate this key on success
 * so the tree refreshes from the authoritative server response.
 */
export function ContentTab({ courseId }: { courseId: number }) {
    const t = useTranslations('admin.courses');
    const [addOpen, setAddOpen] = useState(false);

    const { data: course, isLoading, error } = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId),
        retry: false,
    });

    if (isLoading) {
        return (
            <div className='space-y-2 pt-4'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-32 w-full' />
            </div>
        );
    }
    if (error || !course) {
        return (
            <Alert variant='destructive' className='mt-4'>
                <AlertTitle>{t('generic_error')}</AlertTitle>
                <AlertDescription>{(error as Error)?.message ?? ''}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className='space-y-3 pt-4'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>{t('content_tab')}</h2>
                <Button type='button' variant='default' onClick={() => setAddOpen(true)}>
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_chapter')}
                </Button>
            </div>
            <ChapterTreeEditor courseId={courseId} chapters={course.chapters} />
            <UpsertChapterDialog courseId={courseId} open={addOpen} onOpenChange={setAddOpen} />
        </div>
    );
}
