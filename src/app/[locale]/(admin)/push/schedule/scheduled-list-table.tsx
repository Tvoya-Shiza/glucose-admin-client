'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/users/empty-state';
import { cancelScheduledPush, listScheduledPushes } from '@/lib/push/api';
import type { ScheduledPushRow } from '@/lib/push/types';

type StatusFilter = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
type StatusBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * Phase 8 Plan 04 — scheduled-pushes table (PSH-02).
 *
 * URL state via nuqs: page, page_size, status, creator_id, sort, order. Filter
 * changes reset page=1.
 *
 * Columns: id (truncated), title_kz, scheduled_at (formatted Asia/Almaty),
 * status (badge), audience_count, delivered_count, creator_full_name, actions.
 *
 * Cancel action: only enabled for status='pending'. Opens a confirm Dialog
 * (no AlertDialog primitive vendored yet); confirm calls cancelScheduledPush
 * via TanStack Query mutation. Server enforces the atomic transition; UI
 * surfaces 409 (already in_progress) as a toast.
 */
export function ScheduledListTable() {
    const t = useTranslations('admin.push');
    const locale = useLocale();
    const qc = useQueryClient();

    const [{ page, page_size, status, creator_id, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(25),
        status: parseAsStringEnum<StatusFilter>([
            'pending',
            'in_progress',
            'completed',
            'cancelled',
            'failed',
        ]),
        creator_id: parseAsInteger,
        sort: parseAsString.withDefault('scheduled_at'),
        order: parseAsString.withDefault('desc'),
    });

    const queryKey = useMemo(
        () =>
            [
                'admin.push.scheduled',
                { page, page_size, status, creator_id, sort, order },
            ] as const,
        [page, page_size, status, creator_id, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listScheduledPushes({
                page,
                page_size,
                status: status ?? undefined,
                creator_id: creator_id ?? undefined,
                sort: (sort as 'scheduled_at' | 'created_at' | undefined) ?? undefined,
                order: (order as 'asc' | 'desc' | undefined) ?? undefined,
            }),
    });

    const [cancelTarget, setCancelTarget] = useState<ScheduledPushRow | null>(null);
    const cancelMut = useMutation({
        mutationFn: (id: string) => cancelScheduledPush(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.push.scheduled'] });
            toast.success(t('schedule_cancelled'));
            setCancelTarget(null);
        },
        onError: (e) => {
            const msg = (e as Error).message;
            // Distinguish 409 (already in_progress/completed) for clarity.
            if (msg.includes('409')) {
                toast.error(t('schedule_failed') + ': ' + msg);
            } else {
                toast.error(t('schedule_failed') + ': ' + msg);
            }
            setCancelTarget(null);
        },
    });

    const rows = data?.rows ?? [];
    const dateFmt = useMemo(
        () =>
            new Intl.DateTimeFormat(locale === 'kz' ? 'kk-KZ' : 'ru-RU', {
                timeZone: 'Asia/Almaty',
                dateStyle: 'short',
                timeStyle: 'short',
            }),
        [locale],
    );

    function statusVariant(s: ScheduledPushRow['status']): StatusBadgeVariant {
        switch (s) {
            case 'pending':
                return 'secondary';
            case 'in_progress':
                return 'default';
            case 'completed':
                return 'default';
            case 'cancelled':
                return 'outline';
            case 'failed':
                return 'destructive';
            default:
                return 'outline';
        }
    }

    function statusLabel(s: ScheduledPushRow['status']): string {
        // Keys exist in messages/{ru,kz}.json under admin.push.schedule_status_*.
        const map: Record<ScheduledPushRow['status'], string> = {
            pending: t('schedule_status_pending'),
            in_progress: t('schedule_status_in_progress'),
            completed: t('schedule_status_completed'),
            cancelled: t('schedule_status_cancelled'),
            failed: t('schedule_status_failed'),
        };
        return map[s] ?? s;
    }

    return (
        <div className='flex flex-col gap-4'>
            {/* Filters */}
            <div className='flex flex-wrap items-end gap-3'>
                <div className='flex flex-col gap-1'>
                    <Label className='text-muted-foreground text-xs'>{t('schedule_col_status')}</Label>
                    <Select
                        value={status ?? 'all'}
                        onValueChange={(v) => {
                            void setQ({ status: v === 'all' ? null : (v as StatusFilter), page: 1 });
                        }}
                    >
                        <SelectTrigger className='w-44'>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='all'>—</SelectItem>
                            <SelectItem value='pending'>{t('schedule_status_pending')}</SelectItem>
                            <SelectItem value='in_progress'>{t('schedule_status_in_progress')}</SelectItem>
                            <SelectItem value='completed'>{t('schedule_status_completed')}</SelectItem>
                            <SelectItem value='cancelled'>{t('schedule_status_cancelled')}</SelectItem>
                            <SelectItem value='failed'>{t('schedule_status_failed')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {(isFetching || isLoading) ? (
                    <span className='text-muted-foreground text-xs'>{t('compose_title')}…</span>
                ) : null}
            </div>

            {/* Table */}
            {isLoading ? (
                <div className='flex flex-col gap-2'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className='h-10 w-full' />
                    ))}
                </div>
            ) : error ? (
                <EmptyState title={t('schedule_failed')} subtitle={(error as Error).message} />
            ) : rows.length === 0 ? (
                <EmptyState title={t('schedule_tab')} subtitle={t('schedule_at_help')} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('schedule_col_id')}</TableHead>
                            <TableHead>{t('schedule_col_title')}</TableHead>
                            <TableHead>{t('schedule_col_scheduled_at')}</TableHead>
                            <TableHead>{t('schedule_col_status')}</TableHead>
                            <TableHead>{t('schedule_col_audience')}</TableHead>
                            <TableHead>{t('schedule_col_delivered')}</TableHead>
                            <TableHead>{t('schedule_col_creator')}</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className='font-mono text-xs'>{row.id.slice(0, 8)}</TableCell>
                                <TableCell className='max-w-xs truncate'>{row.title_kz}</TableCell>
                                <TableCell>{dateFmt.format(new Date(row.scheduled_at * 1000))}</TableCell>
                                <TableCell>
                                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                                </TableCell>
                                <TableCell>{row.audience_count}</TableCell>
                                <TableCell>
                                    {row.status === 'completed' || row.status === 'failed'
                                        ? `${row.delivered_count} / ${row.audience_count}`
                                        : '—'}
                                </TableCell>
                                <TableCell>{row.creator_full_name ?? `#${row.creator_id}`}</TableCell>
                                <TableCell>
                                    {row.status === 'pending' ? (
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            onClick={() => setCancelTarget(row)}
                                            disabled={cancelMut.isPending}
                                        >
                                            {t('schedule_cancel')}
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Pagination */}
            {data && data.pageCount > 1 ? (
                <div className='flex items-center justify-end gap-2'>
                    <Button
                        size='sm'
                        variant='outline'
                        disabled={page <= 1}
                        onClick={() => void setQ({ page: page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='text-muted-foreground text-xs'>
                        {page} / {data.pageCount}
                    </span>
                    <Button
                        size='sm'
                        variant='outline'
                        disabled={page >= data.pageCount}
                        onClick={() => void setQ({ page: page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            ) : null}

            {/* Cancel confirm dialog (Dialog reused; AlertDialog primitive not vendored). */}
            <Dialog open={!!cancelTarget} onOpenChange={(o) => (o ? null : setCancelTarget(null))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('schedule_cancel_confirm')}</DialogTitle>
                    </DialogHeader>
                    {cancelTarget ? (
                        <p className='text-muted-foreground text-sm'>
                            {cancelTarget.title_kz}
                            <br />
                            {dateFmt.format(new Date(cancelTarget.scheduled_at * 1000))}
                        </p>
                    ) : null}
                    <DialogFooter>
                        <Button
                            variant='ghost'
                            onClick={() => setCancelTarget(null)}
                            disabled={cancelMut.isPending}
                        >
                            {t('schedule_cancel')}
                        </Button>
                        <Button
                            variant='destructive'
                            onClick={() => cancelTarget && cancelMut.mutate(cancelTarget.id)}
                            disabled={cancelMut.isPending}
                        >
                            {t('schedule_cancel')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
