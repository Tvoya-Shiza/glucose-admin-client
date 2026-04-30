'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { DryRunDialog } from '@/components/users/dry-run-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDryRunPreview } from '@/hooks/use-dry-run-preview';
import { bulkProvisionUsers, type BulkProvisionResult } from '@/lib/users/api';

export interface BulkGrantSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedUserIds: number[];
    onCommitted: (result: BulkProvisionResult) => void;
}

/**
 * USR-04 + USR-05 — Plan 05 BulkGrantSheet.
 *
 * Mounted from the BulkActionToolbar (Plan 02 wired the toolbar slot in
 * `users-list-client.tsx`). Collects webinar_ids + access_days + reason, runs the
 * dry-run via `useDryRunPreview` (generic hook from Plan 01), surfaces results in
 * the `<DryRunDialog>` (which gates >50-affected behind <TypeTheCountConfirmation>),
 * and commits via `bulkProvisionUsers` mutation. On success, invalidates the list
 * query and clears bulk selection.
 *
 * Reference-implementation note: Phase 7 reuses this exact shape for Stories /
 * Banners / Blogs / Promocodes bulk-status changes — re-skin to BulkStatusToggleSheet,
 * swap webinar_ids -> status, reuse `useDryRunPreview` + `<DryRunDialog>` +
 * `<TypeTheCountConfirmation>` unchanged.
 */
export function BulkGrantSheet({ open, onOpenChange, selectedUserIds, onCommitted }: BulkGrantSheetProps) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();

    const [webinarIdsRaw, setWebinarIdsRaw] = useState('');
    const [accessDays, setAccessDays] = useState<string>('');
    const [reason, setReason] = useState('');
    const [dryRunOpen, setDryRunOpen] = useState(false);
    const [bulkOpId, setBulkOpId] = useState<string | null>(null);

    const dryRun = useDryRunPreview();

    /** Parse a free-form list of webinar IDs (commas, whitespace, newlines tolerated). */
    const parseWebinarIds = (): number[] =>
        webinarIdsRaw
            .split(/[,\s]+/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);

    const onPreview = async () => {
        const webinar_ids = parseWebinarIds();
        if (webinar_ids.length === 0) {
            toast.error(t('error_generic'));
            return;
        }
        const adNum = accessDays ? Number(accessDays) : undefined;
        await dryRun.run({
            endpoint: '/api/proxy/v1/admin/users/bulk-provision',
            body: {
                mode: 'dry_run',
                user_ids: selectedUserIds,
                webinar_ids,
                access_days: typeof adNum === 'number' && Number.isFinite(adNum) && adNum > 0 ? adNum : undefined,
                reason: reason || undefined,
            },
        });
        // Capture bulk_op_id from the dry-run so commit reuses it (idempotency hint).
        const dryResult = dryRun.data as unknown as { bulk_op_id?: string } | null;
        if (dryResult?.bulk_op_id) setBulkOpId(dryResult.bulk_op_id);
        setDryRunOpen(true);
    };

    const commit = useMutation({
        mutationFn: () => {
            const webinar_ids = parseWebinarIds();
            const adNum = accessDays ? Number(accessDays) : undefined;
            return bulkProvisionUsers({
                mode: 'commit',
                user_ids: selectedUserIds,
                webinar_ids,
                access_days: typeof adNum === 'number' && Number.isFinite(adNum) && adNum > 0 ? adNum : undefined,
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count: dryRun.data?.affected,
                reason: reason || undefined,
            });
        },
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            toast.success(t('saved'));
            setDryRunOpen(false);
            onOpenChange(false);
            // Reset local state so the next open is fresh.
            setWebinarIdsRaw('');
            setAccessDays('');
            setReason('');
            setBulkOpId(null);
            dryRun.reset();
            onCommitted(result);
        },
        onError: (e: Error) => toast.error(e.message ?? t('save_failed')),
    });

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className='w-[420px] sm:max-w-[420px]'>
                    <SheetHeader>
                        <SheetTitle>{t('bulk_grant_access')}</SheetTitle>
                        <SheetDescription>{t('bulk_selected', { count: selectedUserIds.length })}</SheetDescription>
                    </SheetHeader>
                    <div className='space-y-3 px-4 pb-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='webinar_ids'>webinar_ids</Label>
                            <Input
                                id='webinar_ids'
                                placeholder='123, 456, 789'
                                value={webinarIdsRaw}
                                onChange={(e) => setWebinarIdsRaw(e.target.value)}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='access_days'>access_days</Label>
                            <Input
                                id='access_days'
                                type='number'
                                inputMode='numeric'
                                min={1}
                                max={3650}
                                placeholder='unlimited'
                                value={accessDays}
                                onChange={(e) => setAccessDays(e.target.value)}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='reason'>reason</Label>
                            <Input
                                id='reason'
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
                                disabled={dryRun.status === 'loading' || selectedUserIds.length === 0}
                            >
                                {dryRun.status === 'loading' ? t('loading') : t('bulk_dry_run')}
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
