'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { deleteCourse } from '@/lib/courses/api';
import type { CourseRow } from '@/lib/courses/types';

export interface DeleteCourseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no course is selected — dialog stays closed via `open`. */
    course: CourseRow | null;
    /** Optional: fired after successful delete. */
    onDeleted?: (deletedId: number) => void;
}

/**
 * CRS-01 — admin/teacher delete-course dialog.
 *
 * Soft-delete posture (Plan 02 admin-api): DELETE /:id sets `deleted_at` and the
 * row vanishes from the default list. Translations, chapters, items, schedules
 * remain in DB (filtered by deleted_at on subsequent reads).
 *
 * Cascade copy (mirrors Phase 4 Plan 02 style):
 *   "This will hide the course. Translations, chapters, items, and schedules remain
 *    in the database and can be reviewed separately."
 *
 * Gate: When chapter_count > 5, render `<TypeTheCountConfirmation>` (defense-in-depth
 * for high-impact deletes — surfaces the cascade size to the user). Below the
 * threshold, plain Confirm/Cancel.
 */
const TYPE_GATE_THRESHOLD = 5;

export function DeleteCourseDialog({
    open,
    onOpenChange,
    course,
    onDeleted,
}: DeleteCourseDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteCourse(course!.id),
        onSuccess: () => {
            toast.success(t('delete_success'));
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            const deletedId = course!.id;
            onOpenChange(false);
            onDeleted?.(deletedId);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('delete_error');
            toast.error(msg);
        },
    });

    // Reset mutation state when dialog closes so re-opens start fresh.
    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const onConfirm = () => mutation.mutate();
    const onCancel = () => onOpenChange(false);
    const isPending = mutation.isPending;
    const chapterCount = course?.chapter_count ?? 0;
    const requiresGate = chapterCount > TYPE_GATE_THRESHOLD;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('delete_dialog_description')}</DialogDescription>
                </DialogHeader>

                {course ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-medium'>{course.slug}</p>
                        <p className='text-muted-foreground'>
                            {t('cascade_chapter_count', { count: chapterCount })}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {t('cascade_soft_delete_note')}
                        </p>
                    </div>
                ) : null}

                {course && requiresGate ? (
                    <TypeTheCountConfirmation
                        count={chapterCount}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                        confirmLabel={isPending ? t('loading') : t('delete')}
                        cancelLabel={t('cancel')}
                    />
                ) : (
                    <DialogFooter>
                        <Button variant='outline' onClick={onCancel} disabled={isPending}>
                            {t('cancel')}
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={onConfirm}
                            disabled={isPending || !course}
                        >
                            {isPending ? t('loading') : t('delete')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
