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
import { deleteQuiz } from '@/lib/quizzes/api';
import type { QuizRow } from '@/lib/quizzes/types';

export interface DeleteQuizDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: QuizRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * Admin delete-quiz dialog.
 *
 * Soft-delete posture (Plan 02 admin-api): DELETE /:id sets status='inactive' and the
 * row remains in DB; questions/answers/results all preserved. Re-activation is just
 * a PATCH with status='active'.
 *
 * No type-the-count gate — soft-delete is reversible and child counts aren't surfaced
 * on the row DTO. Plan 04 detail editor will surface richer counts when destructive
 * (status flip back/forward) lifecycle events become observable.
 *
 * RBAC: dialog only mounts for admin (canDelete in QuizzesListClient). Server-side
 * RolesGuard re-checks.
 */
export function DeleteQuizDialog({
    open,
    onOpenChange,
    quiz,
    onDeleted,
}: DeleteQuizDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteQuiz(quiz!.id),
        onSuccess: () => {
            toast.success(t('delete_success'));
            const deletedId = quiz!.id;
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'], exact: false });
            qc.removeQueries({ queryKey: ['admin.quizzes.detail', deletedId] });
            onOpenChange(false);
            onDeleted?.(deletedId);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const isPending = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('delete_dialog_description')}</DialogDescription>
                </DialogHeader>

                {quiz ? (
                    <div className='space-y-2 text-sm'>
                        <p className='font-medium'>{`#${quiz.id}`}</p>
                        <p className='text-xs text-muted-foreground'>
                            {t('delete_soft_note')}
                        </p>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={() => mutation.mutate()}
                        disabled={isPending || !quiz}
                    >
                        {isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
