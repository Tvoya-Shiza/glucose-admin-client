'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteTrainer } from '@/lib/trainers/api';
import type { TrainerRow } from '@/lib/trainers/types';

export interface DeleteTrainerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trainer: TrainerRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * Admin delete-trainer dialog (soft delete). DELETE /:id sets Quizzes.status
 * ='inactive' — with the merged publish column this IS publish_status='hidden'.
 * Children (settings, course links, questions, attempts) are preserved; the
 * trainer is re-publishable. No type-the-count gate — the action is reversible.
 *
 * RBAC: the dialog only mounts when the parent grants `trainers.delete`; the
 * server RolesGuard + PermissionGuard re-check.
 */
export function DeleteTrainerDialog({ open, onOpenChange, trainer, onDeleted }: DeleteTrainerDialogProps) {
    const t = useTranslations('admin.trainers');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteTrainer(trainer!.id),
        onSuccess: () => {
            toast.success(t('delete_success'));
            const deletedId = trainer!.id;
            qc.invalidateQueries({ queryKey: ['admin.trainers.list'], exact: false });
            qc.removeQueries({ queryKey: ['admin.trainers.detail', deletedId] });
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

                {trainer ? (
                    <div className='space-y-2 text-sm'>
                        <p className='font-medium'>{trainer.title_kz ?? `#${trainer.id}`}</p>
                        <p className='text-muted-foreground text-xs'>{t('delete_soft_note')}</p>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={() => mutation.mutate()} disabled={isPending || !trainer}>
                        {isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
