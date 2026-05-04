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
import { bulkUpdateBlogStatus } from '@/lib/blogs/api';
import type { BulkStatusToggleResult, BlogStatus } from '@/lib/blogs/types';

export interface BulkStatusSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedIds: number[];
    /** Target status to flip selected blogs to. */
    targetStatus: BlogStatus;
    onCommitted?: (result: BulkStatusToggleResult) => void;
}

/**
 * BLG-04 — bulk-status sheet (D-12).
 *
 * Reuses Phase 3 Plan 05 + Phase 7 Plan 02 verbatim — only endpoint URL and field
 * name `blog_ids` differ.
 */
export function BulkStatusSheet({
    open,
    onOpenChange,
    selectedIds,
    targetStatus,
    onCommitted,
}: BulkStatusSheetProps) {
    const t = useTranslations('admin.blogs');
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
            endpoint: '/api/proxy/v1/admin/blogs/bulk-status',
            body: {
                mode: 'dry_run',
                blog_ids: selectedIds,
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
            bulkUpdateBlogStatus({
                mode: 'commit',
                blog_ids: selectedIds,
                status: targetStatus,
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count: dryRun.data?.affected,
                reason: reason || undefined,
            }),
        onSuccess: (result) => {
            toast.success(t('bulk_committed'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.list'], exact: false });
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
