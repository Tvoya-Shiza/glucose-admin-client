'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Skeleton } from '@/components/ui/skeleton';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { deleteGroup, getCascadePreview } from '@/lib/groups/api';

export interface DeleteGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null/undefined when no group is selected — dialog stays closed via `open`. */
    groupId: number | null;
    /** Optional: fired after successful delete (e.g. to redirect from detail page). */
    onDeleted?: (deletedId: number) => void;
}

/**
 * GRP-04 + GRP-01 — admin-only delete-with-cascade dialog (D-13 + D-14).
 *
 * Flow:
 *   1. Open with `groupId` -> POST /:id/cascade-preview lazily via TanStack Query.
 *   2. Render `affected_students`, sample names (first 5), `affected_schedules` (always 0
 *      with placeholder note "Phase 5 will fill"), affected_schedules_note.
 *   3. If `affected_students > 0`: render `<TypeTheCountConfirmation>` — user must type
 *      the integer to enable Confirm. If `affected_students === 0`: plain Confirm
 *      button (no gate; safe to delete).
 *   4. Confirm -> DELETE /:id, invalidate ['admin.groups.list'], toast, close.
 *
 * Server-side enforcement of the gate is NOT implemented in admin-api Plan 02 (T-04-14
 * accepted-with-followup). Audit log captures every delete (@Audit('groups.delete', ...)).
 */
export function DeleteGroupDialog({ open, onOpenChange, groupId, onDeleted }: DeleteGroupDialogProps) {
    const t = useTranslations('admin.groups');
    const qc = useQueryClient();

    const preview = useQuery({
        queryKey: ['admin.groups.cascade-preview', groupId],
        queryFn: () => getCascadePreview(groupId as number),
        enabled: open && typeof groupId === 'number' && groupId > 0,
        // Re-fetch on every open so the count is fresh.
        staleTime: 0,
    });

    const mutation = useMutation({
        mutationFn: () => deleteGroup(groupId as number),
        onSuccess: () => {
            toast.success(t('delete_success'));
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.groups.cascade-preview', groupId] });
            const deletedId = groupId as number;
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

    const data = preview.data;
    const isLoading = preview.isLoading || preview.isFetching;
    const isError = preview.isError;
    const isPending = mutation.isPending;

    const onConfirm = () => mutation.mutate();
    const onCancel = () => onOpenChange(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('delete_dialog_description')}</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className='space-y-2'>
                        <Skeleton className='h-5 w-3/4' />
                        <Skeleton className='h-5 w-2/3' />
                        <Skeleton className='h-5 w-1/2' />
                    </div>
                ) : isError ? (
                    <p className='text-sm text-destructive'>{t('error_generic')}</p>
                ) : data ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-medium'>
                            {t('cascade_affected_students', { count: data.affected_students })}
                        </p>
                        {data.sample_student_names.length > 0 ? (
                            <div className='space-y-1'>
                                <p className='text-muted-foreground'>{t('cascade_sample_students')}</p>
                                <ul className='ml-4 list-disc text-muted-foreground'>
                                    {data.sample_student_names.map((n, i) => (
                                        <li key={`${i}-${n}`}>{n}</li>
                                    ))}
                                </ul>
                                {data.affected_students > data.sample_student_names.length ? (
                                    <p className='text-xs text-muted-foreground'>
                                        {t('cascade_more_students', {
                                            count: data.affected_students - data.sample_student_names.length,
                                        })}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <p className='text-muted-foreground'>{t('delete_no_members')}</p>
                        )}
                        <p className='text-muted-foreground'>
                            {t('cascade_affected_schedules', { count: data.affected_schedules })}
                        </p>
                        {data.affected_schedules_note ? (
                            <p className='text-xs text-muted-foreground'>{data.affected_schedules_note}</p>
                        ) : null}
                    </div>
                ) : null}

                {data && !isLoading && !isError ? (
                    data.affected_students > 0 ? (
                        <TypeTheCountConfirmation
                            count={data.affected_students}
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
                            <Button variant='destructive' onClick={onConfirm} disabled={isPending}>
                                {isPending ? t('loading') : t('delete')}
                            </Button>
                        </DialogFooter>
                    )
                ) : (
                    <DialogFooter>
                        <Button variant='outline' onClick={onCancel}>
                            {t('cancel')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
