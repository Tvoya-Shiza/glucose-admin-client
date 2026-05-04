'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DryRunDialog } from '@/components/users/dry-run-dialog';
import { useDryRunPreview } from '@/hooks/use-dry-run-preview';
import { bulkUpdateBannerStatus } from '@/lib/banners/api';
import type { BulkStatusToggleResult, BannerStatus } from '@/lib/banners/types';

export interface BulkStatusSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedIds: number[];
    /** Target status to flip selected banners to. */
    targetStatus: BannerStatus;
    onCommitted?: (result: BulkStatusToggleResult) => void;
}

/**
 * BAN-03 — bulk-status sheet (D-08).
 *
 * Mirrors Plan 02 BulkStatusSheet (Stories) verbatim, with `banner_ids` as the wire
 * field and the BFF endpoint `/api/proxy/v1/admin/banners/bulk-status`.
 *
 * Reuses the Phase 3 Plan 05 BulkGrantSheet shape verbatim:
 *   - Sheet hosts review state (selected count + target status + reason input).
 *   - "Show preview" runs useDryRunPreview against the BFF proxy endpoint.
 *   - DryRunDialog shows the result rows + counts; >50 affected gates the Confirm
 *     button behind <TypeTheCountConfirmation> (handled inside DryRunDialog).
 *   - Commit calls bulkUpdateBannerStatus with the bulk_op_id from the dry-run
 *     (idempotency hint) + confirmed_count = dryRun.affected.
 *
 * On success: invalidate ['admin.banners.list'], close, toast, onCommitted callback.
 */
export function BulkStatusSheet({
    open,
    onOpenChange,
    selectedIds,
    targetStatus,
    onCommitted,
}: BulkStatusSheetProps) {
    const t = useTranslations('admin.banners');
    const qc = useQueryClient();
    const dryRun = useDryRunPreview();
    const [dryRunOpen, setDryRunOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [bulkOpId, setBulkOpId] = useState<string | null>(null);

    const targetCopy = targetStatus === 'publish' ? t('publish_action_short') : t('unpublish_action_short');

    const onPreview = async () => {
        if (selectedIds.length === 0) {
            toast.error(t('error_generic'));
            return;
        }
        await dryRun.run({
            endpoint: '/api/proxy/v1/admin/banners/bulk-status',
            body: {
                mode: 'dry_run',
                banner_ids: selectedIds,
                status: targetStatus,
                reason: reason || undefined,
            },
        });
        const data = dryRun.data as unknown as { bulk_op_id?: string } | null;
        if (data?.bulk_op_id) setBulkOpId(data.bulk_op_id);
        setDryRunOpen(true);
    };

    const commit = useMutation({
        mutationFn: () =>
            bulkUpdateBannerStatus({
                mode: 'commit',
                banner_ids: selectedIds,
                status: targetStatus,
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count: dryRun.data?.affected,
                reason: reason || undefined,
            }),
        onSuccess: (result) => {
            toast.success(t('bulk_committed'));
            qc.invalidateQueries({ queryKey: ['admin.banners.list'], exact: false });
            setDryRunOpen(false);
            onOpenChange(false);
            setReason('');
            setBulkOpId(null);
            dryRun.reset();
            onCommitted?.(result as unknown as BulkStatusToggleResult);
        },
        onError: (err: Error) => toast.error(err.message ?? t('save_failed')),
    });

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className='w-[420px] sm:max-w-[420px]'>
                    <SheetHeader>
                        <SheetTitle>{targetCopy}</SheetTitle>
                        <SheetDescription>
                            {t('bulk_selected', { count: selectedIds.length })}
                        </SheetDescription>
                    </SheetHeader>
                    <div className='space-y-3 px-4 pb-4'>
                        <div className='space-y-2'>
                            <Label>{t('status_label')}</Label>
                            <p className='text-sm text-muted-foreground'>
                                {targetStatus === 'publish'
                                    ? t('status_publish')
                                    : t('status_pending')}
                            </p>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='reason'>—</Label>
                            <Input
                                id='reason'
                                placeholder='reason (optional)'
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <div className='flex justify-end gap-2 pt-2'>
                            <Button variant='outline' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button
                                onClick={onPreview}
                                disabled={dryRun.status === 'loading' || selectedIds.length === 0}
                            >
                                {dryRun.status === 'loading'
                                    ? t('bulk_dry_run_loading')
                                    : t('bulk_dry_run_preview')}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <DryRunDialog
                open={dryRunOpen}
                onOpenChange={(o) => {
                    setDryRunOpen(o);
                    if (!o) dryRun.reset();
                }}
                result={dryRun.data}
                onConfirm={() => commit.mutate()}
                threshold={50}
            />
        </>
    );
}
