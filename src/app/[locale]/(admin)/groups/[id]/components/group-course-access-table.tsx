'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/lib/access/use-permission';
import { listGroupGrants, revokeAccess } from '@/lib/course-access/api';
import { formatScheduleDate } from '@/lib/schedules/format';
import type { CourseGrantRow } from '@/lib/course-access/types';
import { ExtendCourseAccessDialog } from './extend-course-access-dialog';

export interface GroupCourseAccessTableProps {
    groupId: number;
}

/**
 * Phase 18 — Feature A list table.
 *
 * Columns: Course | Granted | Expires | Days left | Status | Granted by | Actions
 *
 * Actions:
 *   - "Extend" → opens ExtendCourseAccessDialog (gated by course_access.extend)
 *   - "Revoke" → confirm modal → DELETE /sales/:saleId/access (course_access.revoke)
 *
 * URL state: page/page_size via nuqs (?page= / ?page_size=). Filter scope is
 * intentionally bare — operators rarely have more than a screenful of grants
 * per group.
 */
export function GroupCourseAccessTable({ groupId }: GroupCourseAccessTableProps) {
    const t = useTranslations('admin.course_access');
    const locale = useLocale();
    const qc = useQueryClient();
    const canExtend = usePermission('course_access.extend');
    const canRevoke = usePermission('course_access.revoke');

    const [{ page, page_size }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(20),
    });

    const invalidateKey = ['admin.course-access.group', groupId] as const;

    const { data, isLoading, isFetching } = useQuery({
        queryKey: [...invalidateKey, { page, page_size }],
        queryFn: () => listGroupGrants(groupId, { page, page_size }),
        staleTime: 30_000,
    });

    const rows: CourseGrantRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    // Local UI state for dialogs.
    const [extendRow, setExtendRow] = useState<CourseGrantRow | null>(null);
    const [revokeRow, setRevokeRow] = useState<CourseGrantRow | null>(null);

    const revokeMutation = useMutation({
        mutationFn: (saleId: number) => revokeAccess(saleId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: invalidateKey, exact: false });
            toast.success(t('revoked_toast'));
            setRevokeRow(null);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('already_revoked')) toast.error(t('error_already_revoked'));
            else if (msg.includes('sale_not_found') || msg.includes('404')) toast.error(t('error_sale_not_found'));
            else toast.error(t('error_generic'));
        },
    });

    if (isLoading) {
        return <Skeleton className='h-64 w-full' />;
    }

    return (
        <div className='space-y-3'>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('col_course')}</TableHead>
                        <TableHead>{t('col_granted_at')}</TableHead>
                        <TableHead>{t('col_expires_at')}</TableHead>
                        <TableHead>{t('col_days_remaining')}</TableHead>
                        <TableHead>{t('col_status')}</TableHead>
                        <TableHead>{t('col_granted_by')}</TableHead>
                        <TableHead className='text-right'>{t('col_actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className='text-center text-muted-foreground'>
                                {t('empty')}
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((r) => (
                            <TableRow key={r.sale_id}>
                                <TableCell>
                                    <div className='font-medium'>{r.course.title}</div>
                                    <div className='text-xs text-muted-foreground'>{r.course.slug}</div>
                                </TableCell>
                                <TableCell className='text-xs'>
                                    {formatScheduleDate(r.granted_at, locale)}
                                </TableCell>
                                <TableCell className='text-xs'>
                                    {r.expires_at == null ? (
                                        <span className='text-muted-foreground'>{t('perpetual')}</span>
                                    ) : (
                                        formatScheduleDate(r.expires_at, locale)
                                    )}
                                </TableCell>
                                <TableCell className='text-xs font-mono'>
                                    {r.days_remaining == null
                                        ? '∞'
                                        : r.days_remaining === 0
                                          ? t('expired')
                                          : r.days_remaining}
                                </TableCell>
                                <TableCell>
                                    {r.refund_at !== null ? (
                                        <Badge variant='secondary'>{t('status_revoked')}</Badge>
                                    ) : r.is_active ? (
                                        <Badge>{t('status_active')}</Badge>
                                    ) : (
                                        <Badge variant='secondary'>{t('status_expired')}</Badge>
                                    )}
                                </TableCell>
                                <TableCell className='text-xs'>
                                    {r.granted_by?.full_name ?? `#${r.granted_by?.id ?? '—'}`}
                                </TableCell>
                                <TableCell className='space-x-2 text-right'>
                                    {canExtend && r.refund_at === null ? (
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            onClick={() => setExtendRow(r)}
                                        >
                                            {t('extend')}
                                        </Button>
                                    ) : null}
                                    {canRevoke && r.refund_at === null ? (
                                        <Button
                                            size='sm'
                                            variant='destructive'
                                            onClick={() => setRevokeRow(r)}
                                        >
                                            {t('revoke')}
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            <DataTablePagination
                page={page}
                pageSize={page_size}
                total={total}
                rowCount={rows.length}
                isFetching={isFetching}
                onPageChange={(p) => setQ({ page: p })}
                onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
            />

            {extendRow ? (
                <ExtendCourseAccessDialog
                    open
                    onOpenChange={(open) => !open && setExtendRow(null)}
                    saleId={extendRow.sale_id}
                    currentExpiresAt={extendRow.expires_at}
                    courseTitle={extendRow.course.title}
                    invalidateKey={invalidateKey}
                />
            ) : null}

            {/* Revoke confirmation dialog — kept inline since it's a single destructive action. */}
            <Dialog open={!!revokeRow} onOpenChange={(open) => !open && setRevokeRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('revoke_confirm_title')}</DialogTitle>
                        <DialogDescription>
                            {revokeRow ? (
                                <span>
                                    {t('revoke_confirm_body', { course: revokeRow.course.title })}
                                </span>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setRevokeRow(null)}
                            disabled={revokeMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            onClick={() => revokeRow && revokeMutation.mutate(revokeRow.sale_id)}
                            disabled={revokeMutation.isPending}
                        >
                            {revokeMutation.isPending ? t('loading') : t('revoke')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
