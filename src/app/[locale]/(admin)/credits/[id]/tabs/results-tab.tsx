'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock, History } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPicker } from '@/components/users/user-picker';
import { usePermission } from '@/lib/access/use-permission';
import { listCreditHistory } from '@/lib/credits/api';
import { formatUnixDateTimeOrDash } from '@/lib/credits/format';
import type { CreditHistoryRow, CreditSessionStatus } from '@/lib/credits/types';
import { ResultStatusBadge } from '../components/result-status-badge';
import { ScheduleRetakeDialog } from '../components/schedule-retake-dialog';

const STATUSES: CreditSessionStatus[] = ['pending', 'in_progress', 'finished', 'expired', 'cancelled'];

/**
 * Results tab — attempt history per contract (`GET /credits/:id/history`) with
 * student + status filters, passed/failed/retake badges, and a schedule-retake
 * action on failed (finalized non-passed) rows.
 */
export function ResultsTab({ creditId }: { creditId: string }) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const canConduct = usePermission('credits.conduct');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [studentId, setStudentId] = useState<number | null>(null);
    const [status, setStatus] = useState<CreditSessionStatus | null>(null);
    const [retakeRow, setRetakeRow] = useState<CreditHistoryRow | null>(null);

    const queryKey = useMemo(
        () => ['admin.credits.history', creditId, { page, page_size: pageSize, student_id: studentId, status }] as const,
        [creditId, page, pageSize, studentId, status]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listCreditHistory(creditId, {
                page,
                page_size: pageSize,
                student_id: studentId ?? undefined,
                status: status ?? undefined,
            }),
        staleTime: 0,
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    const canScheduleRetake = (row: CreditHistoryRow) =>
        canConduct && !row.passed && (row.status === 'finished' || row.status === 'expired');

    return (
        <div className='space-y-4'>
            <Card className='p-0'>
                <div className='flex flex-wrap items-center gap-3 p-4'>
                    <div className='w-64'>
                        <UserPicker
                            roles={['student']}
                            value={studentId}
                            onChange={(id) => {
                                setStudentId(id);
                                setPage(1);
                            }}
                            placeholder={t('filter_student')}
                        />
                    </div>
                    <Select
                        value={status ?? '__all__'}
                        onValueChange={(v) => {
                            setStatus(v === '__all__' ? null : (v as CreditSessionStatus));
                            setPage(1);
                        }}
                    >
                        <SelectTrigger className='w-52'>
                            <SelectValue placeholder={t('filter_status')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                            {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {t(`session_status_${s}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={History} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={History} title={t('empty_results')} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('col_student')}</TableHead>
                                <TableHead>{t('col_attempt')}</TableHead>
                                <TableHead>{t('col_started')}</TableHead>
                                <TableHead>{t('col_finished')}</TableHead>
                                <TableHead>{t('col_score')}</TableHead>
                                <TableHead>{t('col_result')}</TableHead>
                                <TableHead>{t('col_retake')}</TableHead>
                                <TableHead className='w-12'>{t('row_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 8 }).map((_, i) => (
                                      <TableRow key={`sk-${i}`}>
                                          <TableCell colSpan={8}>
                                              <Skeleton className='h-6 w-full' />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((r) => (
                                      <TableRow key={r.session_id}>
                                          <TableCell className='font-medium'>{r.student.full_name}</TableCell>
                                          <TableCell className='tabular-nums'>{r.attempt_number}</TableCell>
                                          <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.started_at, locale)}</TableCell>
                                          <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.finished_at, locale)}</TableCell>
                                          <TableCell className='tabular-nums text-sm'>
                                              {r.score != null && r.percent != null ? (
                                                  <>
                                                      {r.score}/{r.max_score}
                                                      <span className='text-muted-foreground'> · {r.percent}%</span>
                                                  </>
                                              ) : (
                                                  '—'
                                              )}
                                          </TableCell>
                                          <TableCell>
                                              <ResultStatusBadge status={r.status} passed={r.passed} />
                                          </TableCell>
                                          <TableCell className='text-sm'>
                                              {r.retake_at != null ? (
                                                  <Badge variant='info'>
                                                      {t('retake_scheduled', {
                                                          date: formatUnixDateTimeOrDash(r.retake_at, locale),
                                                      })}
                                                  </Badge>
                                              ) : (
                                                  '—'
                                              )}
                                          </TableCell>
                                          <TableCell>
                                              {canScheduleRetake(r) ? (
                                                  <Button
                                                      variant='ghost'
                                                      size='sm'
                                                      onClick={() => setRetakeRow(r)}
                                                      aria-label={t('schedule_retake')}
                                                  >
                                                      <CalendarClock className='mr-1 h-4 w-4' />
                                                      {t('schedule_retake')}
                                                  </Button>
                                              ) : null}
                                          </TableCell>
                                      </TableRow>
                                  ))}
                        </TableBody>
                    </Table>
                )}
                {rows.length > 0 || page > 1 ? (
                    <DataTablePagination
                        page={page}
                        pageSize={pageSize}
                        total={total}
                        rowCount={rows.length}
                        isFetching={isFetching}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                            setPage(1);
                            setPageSize(size);
                        }}
                    />
                ) : null}
            </Card>

            <ScheduleRetakeDialog
                open={retakeRow !== null}
                onOpenChange={(o) => {
                    if (!o) setRetakeRow(null);
                }}
                creditId={creditId}
                row={retakeRow}
            />
        </div>
    );
}
