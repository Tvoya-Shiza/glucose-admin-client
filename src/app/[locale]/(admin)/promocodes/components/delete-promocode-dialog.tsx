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
import { deletePromocode } from '@/lib/promocodes/api';
import type { PromocodeRow } from '@/lib/promocodes/types';

export interface DeletePromocodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no row is selected — dialog stays closed via `open`. */
    promocode: PromocodeRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * PRM-01 — admin hard-delete dialog.
 *
 * Promocode has no `deleted_at` column on the schema, so DELETE is irreversible
 * and CASCADES PromocodeUsage rows (T-07-05-08 — accepted in threat model).
 *
 * Gating:
 *   - usage_count > 0 → `<TypeTheCountConfirmation count={promocode.id}>` gate
 *     surfaces the type-id-to-confirm copy and shows the cascade warning.
 *   - usage_count === 0 → simple Confirm/Cancel.
 *
 * On success: invalidate ['admin.promocodes.list'], close, toast.
 */
export function DeletePromocodeDialog({
    open,
    onOpenChange,
    promocode,
    onDeleted,
}: DeletePromocodeDialogProps) {
    const t = useTranslations('admin.promocodes');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deletePromocode(promocode!.id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            const id = promocode!.id;
            qc.invalidateQueries({ queryKey: ['admin.promocodes.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.promocodes.detail', id], exact: false });
            onOpenChange(false);
            onDeleted?.(id);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const onConfirm = () => mutation.mutate();
    const onCancel = () => onOpenChange(false);
    const isPending = mutation.isPending;

    const usageCount = promocode?.usage_count ?? 0;
    const hasUsages = usageCount > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_confirm')}</DialogTitle>
                    <DialogDescription>
                        {hasUsages
                            ? t('delete_warning_with_usages', { count: usageCount })
                            : t('delete_warning_no_usages')}
                    </DialogDescription>
                </DialogHeader>

                {promocode ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-mono'>{promocode.code}</p>
                        <p className='text-xs text-muted-foreground'>#{promocode.id}</p>
                    </div>
                ) : null}

                {promocode ? (
                    hasUsages ? (
                        <TypeTheCountConfirmation
                            count={promocode.id}
                            helperText={t('type_id_to_confirm', { id: promocode.id })}
                            onConfirm={onConfirm}
                            onCancel={onCancel}
                            confirmLabel={isPending ? t('saving') : t('delete')}
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
                                disabled={isPending}
                            >
                                {isPending ? t('saving') : t('delete')}
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
