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
import { deleteBanner } from '@/lib/banners/api';
import type { BannerRow } from '@/lib/banners/types';

export interface DeleteBannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no row is selected — dialog stays closed via `open`. */
    banner: BannerRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * BAN-01 — admin hard-delete dialog.
 *
 * Mirrors DeleteStoryDialog (Plan 02). Advertisement has no `deleted_at` column,
 * so DELETE is irreversible. We gate Delete behind <TypeTheCountConfirmation
 * count={banner.id}> — the high-trust mutation pattern from Phase 3 Plan 04
 * (D-11 reference-implementation contract).
 *
 * On success: invalidate ['admin.banners.list'], close, toast.
 */
export function DeleteBannerDialog({ open, onOpenChange, banner, onDeleted }: DeleteBannerDialogProps) {
    const t = useTranslations('admin.banners');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteBanner(banner!.id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.banners.list'], exact: false });
            const id = banner!.id;
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_confirm')}</DialogTitle>
                    <DialogDescription>{t('delete_warning')}</DialogDescription>
                </DialogHeader>

                {banner ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-medium'>{banner.title_kz ?? banner.slug}</p>
                        <p className='text-xs text-muted-foreground'>#{banner.id}</p>
                    </div>
                ) : null}

                {banner ? (
                    <TypeTheCountConfirmation
                        count={banner.id}
                        helperText={t('type_id_to_confirm', { id: banner.id })}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                        confirmLabel={isPending ? t('saving') : t('delete')}
                        cancelLabel={t('cancel')}
                    />
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
