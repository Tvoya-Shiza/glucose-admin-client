'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/lib/access/use-permission';

import { exportTrainerResults, getTrainerResultsStats, listTrainerResults } from '@/lib/trainers/api';
import { formatUnixDateTimeOrDash, formatElapsed } from '@/lib/trainers/datetime';
import type { ExportTrainerResults, TrainerAttemptStatus, TrainerResultRow, TrainerResultsSortField } from '@/lib/trainers/types';
import { TrainerResultsFilters, type TrainerResultsFiltersValue } from './trainer-results-filters';
import { AttemptAnswersDialog } from './attempt-answers-dialog';

function statusVariant(status: TrainerAttemptStatus): 'success' | 'secondary' | 'outline' | 'muted' {
    switch (status) {
        case 'finished':
            return 'success';
        case 'in_progress':
            return 'secondary';
        case 'paused':
            return 'outline';
        case 'abandoned':
            return 'muted';
    }
}

/**
 * Phase 38 — trainer attempt results list (ТЗ §5.6).
 *
 * Scoped to one trainer (trainer_id fixed). URL filter state via nuqs (page,
 * page_size, group_id, date range, status). A compact stats strip + the paginated
 * table share the exact same filter set — both go through the same admin-api WHERE
 * so the header and rows always agree.
 *
 * «Excel-ге жүктеу» (trainers.export): POSTs the current filter set and downloads
 * the server-generated xlsx blob (filename applied client-side, so it works even
 * if the proxy drops Content-Disposition).
 */
export function TrainerResultsList({ trainerId }: { trainerId: number }) {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();
    const canExport = usePermission('trainers.export');
    /** Открытая попытка в диалоге разбора ответов; null — диалог закрыт. */
    const [answersAttemptId, setAnswersAttemptId] = useState<string | null>(null);

    const [{ page, page_size, group_id, course_id, date_from, date_to, status, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        group_id: parseAsInteger,
        course_id: parseAsInteger,
        date_from: parseAsInteger,
        date_to: parseAsInteger,
        status: parseAsString,
        sort: parseAsString,
        order: parseAsString,
    });

    const filters = useMemo(
        () => ({
            trainer_id: trainerId,
            group_id: group_id ?? undefined,
            course_id: course_id ?? undefined,
            date_from: date_from ?? undefined,
            date_to: date_to ?? undefined,
            status: (status as TrainerAttemptStatus | null) ?? undefined,
            sort: (sort as TrainerResultsSortField | null) ?? undefined,
            order: (order as 'asc' | 'desc' | null) ?? undefined,
        }),
        [trainerId, group_id, course_id, date_from, date_to, status, sort, order]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey: ['admin.trainer-results.list', { ...filters, page, page_size }],
        queryFn: () =>
            listTrainerResults({ ...filters, page, page_size, sort: filters.sort ?? 'started_at', order: filters.order ?? 'desc' }),
        placeholderData: (prev) => prev,
    });

    const stats = useQuery({
        queryKey: ['admin.trainer-results.stats', filters],
        queryFn: () => getTrainerResultsStats(filters),
        placeholderData: (prev) => prev,
    });

    const rows: TrainerResultRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const exportMutation = useMutation({
        mutationFn: () => {
            const payload: ExportTrainerResults = { format: 'xlsx', ...filters };
            return exportTrainerResults(payload);
        },
        onSuccess: () => toast.success(t('results_export_started')),
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    const filtersValue: TrainerResultsFiltersValue = {
        group_id: group_id ?? undefined,
        course_id: course_id ?? undefined,
        date_from: date_from ?? undefined,
        date_to: date_to ?? undefined,
        status: (status as TrainerAttemptStatus | null) ?? undefined,
        sort: (sort as TrainerResultsSortField | null) ?? undefined,
        order: (order as 'asc' | 'desc' | null) ?? undefined,
    };

    return (
        <div className='flex flex-col gap-3 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div className='flex flex-wrap gap-4 text-sm'>
                    <StatChip label={t('results_stat_total')} value={stats.data?.total} />
                    <StatChip label={t('results_stat_finished')} value={stats.data?.finished} />
                    <StatChip label={t('results_stat_in_progress')} value={stats.data?.in_progress} />
                    <StatChip
                        label={t('results_stat_avg_score')}
                        value={stats.data?.avg_score_percent == null ? '—' : `${stats.data.avg_score_percent}%`}
                    />
                    <StatChip label={t('results_stat_unique_students')} value={stats.data?.unique_students} />
                </div>
                {canExport ? (
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => exportMutation.mutate()}
                        disabled={exportMutation.isPending || total === 0}
                    >
                        <Download className='mr-2 h-4 w-4' />
                        {exportMutation.isPending ? t('loading') : t('results_export')}
                    </Button>
                ) : null}
            </div>

            <TrainerResultsFilters
                value={filtersValue}
                onChange={(next) =>
                    setQ({
                        page: 1,
                        group_id: next.group_id ?? null,
                        course_id: next.course_id ?? null,
                        date_from: next.date_from ?? null,
                        date_to: next.date_to ?? null,
                        status: next.status ?? null,
                        sort: next.sort ?? null,
                        order: next.order ?? null,
                    })
                }
            />

            {error ? (
                <div className='rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
                    {(error as Error).message || t('generic_error')}
                </div>
            ) : !isLoading && rows.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-8 text-center text-sm'>{t('results_empty')}</div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('results_col_student')}</TableHead>
                            <TableHead>{t('results_col_attempt')}</TableHead>
                            <TableHead>{t('results_col_status')}</TableHead>
                            <TableHead>{t('results_col_score')}</TableHead>
                            <TableHead>{t('results_col_breakdown')}</TableHead>
                            <TableHead>{t('results_col_elapsed')}</TableHead>
                            <TableHead>{t('results_col_finished')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading
                            ? Array.from({ length: 8 }).map((_, i) => (
                                  <TableRow key={`sk-${i}`}>
                                      <TableCell colSpan={7}>
                                          <Skeleton className='h-6 w-full' />
                                      </TableCell>
                                  </TableRow>
                              ))
                            : rows.map((r) => {
                                  const studentLabel =
                                      r.user?.full_name?.trim() || r.user?.mobile?.trim() || (r.user ? `#${r.user.id}` : '—');
                                  const subtitle = r.user?.full_name && r.user?.mobile ? r.user.mobile : null;
                                  return (
                                      <TableRow
                                          key={r.id}
                                          onClick={() => setAnswersAttemptId(String(r.id))}
                                          className='hover:bg-muted/50 cursor-pointer'
                                          title={t('answers_open_hint')}
                                      >
                                          <TableCell>
                                              <div className='flex flex-col gap-0.5'>
                                                  <span className='text-sm'>{studentLabel}</span>
                                                  {subtitle ? <span className='text-muted-foreground text-xs'>{subtitle}</span> : null}
                                                  {r.groups.length > 0 ? (
                                                      <span className='text-muted-foreground text-xs'>{r.groups.join(', ')}</span>
                                                  ) : null}
                                              </div>
                                          </TableCell>
                                          <TableCell className='tabular-nums text-sm'>{r.attempt_number ?? '—'}</TableCell>
                                          <TableCell>
                                              <Badge variant={statusVariant(r.status)}>{t(`attempt_status_${r.status}`)}</Badge>
                                          </TableCell>
                                          <TableCell className='tabular-nums text-sm'>
                                              {r.score} / {r.max_score}
                                          </TableCell>
                                          <TableCell className='text-sm'>
                                              <span className='text-emerald-600 dark:text-emerald-400'>{r.correct_count}</span>
                                              <span className='text-muted-foreground'> · </span>
                                              <span className='text-destructive'>{r.incorrect_count}</span>
                                              <span className='text-muted-foreground'> · {r.skipped_count}</span>
                                          </TableCell>
                                          <TableCell className='tabular-nums text-sm'>{formatElapsed(r.elapsed_sec)}</TableCell>
                                          <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.finished_at, locale)}</TableCell>
                                      </TableRow>
                                  );
                              })}
                    </TableBody>
                </Table>
            )}

            {rows.length > 0 || page > 1 ? (
                <DataTablePagination
                    page={page}
                    pageSize={page_size}
                    total={total}
                    rowCount={rows.length}
                    isFetching={isFetching}
                    onPageChange={(p) => setQ({ page: p })}
                    onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                />
            ) : null}

            <AttemptAnswersDialog attemptId={answersAttemptId} onOpenChange={(open) => !open && setAnswersAttemptId(null)} />
        </div>
    );
}

function StatChip({ label, value }: { label: string; value: number | string | undefined }) {
    return (
        <div className='flex flex-col'>
            <span className='text-muted-foreground text-xs'>{label}</span>
            <span className='tabular-nums font-semibold'>{value ?? '—'}</span>
        </div>
    );
}
