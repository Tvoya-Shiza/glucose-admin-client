'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { DryRunDialog } from '@/components/users/dry-run-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDryRunPreview } from '@/hooks/use-dry-run-preview';
import { listCourses } from '@/lib/courses/api';
import type { CourseRow } from '@/lib/courses/types';
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
 * `users-list-client.tsx`). Lets the operator pick courses BY NAME via an embedded
 * searchable picker (over `listCourses`) — the selected course ids become
 * `webinar_ids` (courses are `Webinar` rows in the schema). This replaced the old
 * raw-id textbox: operators had no way to know valid ids, so wrong ids returned
 * `webinar_not_found` and the grant silently did nothing.
 *
 * The picker mirrors `BulkAddMembersSheet` (search + page-scoped checkbox list +
 * `useBulkSelection`). After choosing courses + optional access_days + reason it
 * runs the dry-run via `useDryRunPreview`, surfaces results in `<DryRunDialog>`
 * (which gates >50-affected behind `<TypeTheCountConfirmation>`), and commits via
 * the `bulkProvisionUsers` mutation. On success, invalidates the list query and
 * clears bulk selection.
 */
export function BulkGrantSheet({ open, onOpenChange, selectedUserIds, onCommitted }: BulkGrantSheetProps) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();

    const courseSelection = useBulkSelection<number>();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const page_size = 50;

    const [accessDays, setAccessDays] = useState<string>('');
    const [reason, setReason] = useState('');
    const [dryRunOpen, setDryRunOpen] = useState(false);
    const [bulkOpId, setBulkOpId] = useState<string | null>(null);

    const dryRun = useDryRunPreview();

    // Reset everything when the sheet closes so re-open is fresh.
    useEffect(() => {
        if (!open) {
            courseSelection.clear();
            setSearch('');
            setPage(1);
            setAccessDays('');
            setReason('');
            setDryRunOpen(false);
            setBulkOpId(null);
            dryRun.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const coursesQuery = useQuery({
        queryKey: ['admin.courses.picker', page, page_size, search],
        queryFn: () =>
            listCourses({
                page,
                page_size,
                q: search || undefined,
                sort: 'created_at',
                order: 'desc',
            }),
        enabled: open, // do not preload; only when the sheet is open
    });

    const courseRows: CourseRow[] = coursesQuery.data?.rows ?? [];
    const idRows = courseRows.map((r) => ({ id: r.id }));
    const isPageAllSelected = courseSelection.isPageAllSelected(idRows);
    const selectedCourseIds = Array.from(courseSelection.selected);
    const total = coursesQuery.data?.total ?? 0;

    const accessDaysNum = () => {
        const n = accessDays ? Number(accessDays) : undefined;
        return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
    };

    const onPreview = async () => {
        if (selectedCourseIds.length === 0) {
            toast.error(t('bulk_grant_no_courses'));
            return;
        }
        await dryRun.run({
            endpoint: '/api/proxy/v1/admin/users/bulk-provision',
            body: {
                mode: 'dry_run',
                user_ids: selectedUserIds,
                webinar_ids: selectedCourseIds,
                access_days: accessDaysNum(),
                reason: reason || undefined,
            },
        });
        // Capture bulk_op_id from the dry-run so commit reuses it (idempotency hint).
        const dryResult = dryRun.data as unknown as { bulk_op_id?: string } | null;
        if (dryResult?.bulk_op_id) setBulkOpId(dryResult.bulk_op_id);
        setDryRunOpen(true);
    };

    const commit = useMutation({
        mutationFn: () =>
            bulkProvisionUsers({
                mode: 'commit',
                user_ids: selectedUserIds,
                webinar_ids: selectedCourseIds,
                access_days: accessDaysNum(),
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count: dryRun.data?.affected,
                reason: reason || undefined,
            }),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            toast.success(t('saved'));
            setDryRunOpen(false);
            onOpenChange(false);
            // Reset local state so the next open is fresh.
            courseSelection.clear();
            setSearch('');
            setPage(1);
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
                <SheetContent className='w-[520px] sm:max-w-[520px]'>
                    <SheetHeader>
                        <SheetTitle>{t('bulk_grant_access')}</SheetTitle>
                        <SheetDescription>{t('bulk_selected', { count: selectedUserIds.length })}</SheetDescription>
                    </SheetHeader>
                    <div className='space-y-3 px-4 pb-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='course-search'>{t('bulk_grant_courses_label')}</Label>
                            <Input
                                id='course-search'
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                placeholder={t('bulk_grant_courses_search')}
                            />
                        </div>

                        <div className='max-h-64 overflow-auto rounded-md border'>
                            <table className='w-full text-sm'>
                                <thead className='border-b bg-muted/40'>
                                    <tr>
                                        <th className='w-10 p-2 text-left'>
                                            <Checkbox
                                                checked={isPageAllSelected}
                                                onCheckedChange={() => courseSelection.togglePageScoped(idRows)}
                                                aria-label='select page'
                                            />
                                        </th>
                                        <th className='p-2 text-left'>{t('col_course')}</th>
                                        <th className='w-16 p-2 text-right'>ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coursesQuery.isLoading ? (
                                        <tr>
                                            <td colSpan={3} className='p-4 text-muted-foreground'>
                                                {t('loading')}
                                            </td>
                                        </tr>
                                    ) : courseRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className='p-4 text-muted-foreground'>
                                                {t('bulk_grant_courses_empty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        courseRows.map((r) => (
                                            <tr key={r.id} className='border-b last:border-0'>
                                                <td className='p-2'>
                                                    <Checkbox
                                                        checked={courseSelection.isSelected(r.id)}
                                                        onCheckedChange={() => courseSelection.toggle(r.id)}
                                                        aria-label={`select ${r.id}`}
                                                    />
                                                </td>
                                                <td className='p-2'>{r.title_kz || r.slug}</td>
                                                <td className='p-2 text-right font-mono text-xs text-muted-foreground'>
                                                    {r.id}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    ‹
                                </Button>
                                <span className='text-xs text-muted-foreground'>
                                    {page} / {Math.max(1, Math.ceil(total / page_size))}
                                </span>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={page * page_size >= total}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    ›
                                </Button>
                            </div>
                            <div className='text-xs text-muted-foreground'>
                                {t('bulk_grant_courses_selected', { count: selectedCourseIds.length })}
                            </div>
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='access_days'>{t('bulk_grant_access_days_label')}</Label>
                            <Input
                                id='access_days'
                                type='number'
                                inputMode='numeric'
                                min={1}
                                max={3650}
                                placeholder={t('bulk_grant_access_days_placeholder')}
                                value={accessDays}
                                onChange={(e) => setAccessDays(e.target.value)}
                            />
                            <p className='text-xs text-muted-foreground'>{t('bulk_grant_access_days_helper')}</p>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='reason'>{t('bulk_grant_reason_label')}</Label>
                            <Input
                                id='reason'
                                placeholder={t('bulk_grant_reason_placeholder')}
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
                                disabled={
                                    dryRun.status === 'loading' ||
                                    selectedUserIds.length === 0 ||
                                    selectedCourseIds.length === 0
                                }
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
