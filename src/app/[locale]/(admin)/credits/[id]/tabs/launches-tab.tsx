'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Rocket } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listCreditLaunches } from '@/lib/credits/api';
import { formatUnixDateTimeOrDash } from '@/lib/credits/format';
import type { CreditLaunchStatus } from '@/lib/credits/types';

const LAUNCH_STATUS_VARIANT: Record<CreditLaunchStatus, 'info' | 'success' | 'muted'> = {
    active: 'info',
    completed: 'success',
    cancelled: 'muted',
};

/** Launches tab — paged launch list; row click opens the conduct console. */
export function LaunchesTab({ creditId }: { creditId: string }) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const router = useRouter();

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const queryKey = useMemo(
        () => ['admin.credits.launches', creditId, { page, page_size: pageSize }] as const,
        [creditId, page, pageSize]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () => listCreditLaunches(creditId, { page, page_size: pageSize }),
        staleTime: 0,
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    return (
        <Card className='overflow-hidden p-0'>
            {error ? (
                <EmptyState icon={Rocket} title={t('generic_error')} subtitle={(error as Error).message} />
            ) : !isLoading && rows.length === 0 ? (
                <EmptyState icon={Rocket} title={t('empty_launches')} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('col_launch_created')}</TableHead>
                            <TableHead>{t('col_launch_status')}</TableHead>
                            <TableHead>{t('col_launch_settings')}</TableHead>
                            <TableHead>{t('col_launch_students')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading
                            ? Array.from({ length: 6 }).map((_, i) => (
                                  <TableRow key={`sk-${i}`}>
                                      <TableCell colSpan={4}>
                                          <Skeleton className='h-6 w-full' />
                                      </TableCell>
                                  </TableRow>
                              ))
                            : rows.map((r) => (
                                  <TableRow
                                      key={r.id}
                                      className='cursor-pointer'
                                      onClick={() => router.push(`/${locale}/credits/${creditId}/launches/${r.id}`)}
                                  >
                                      <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.created_at, locale)}</TableCell>
                                      <TableCell>
                                          <Badge variant={LAUNCH_STATUS_VARIANT[r.status]}>{t(`launch_status_${r.status}`)}</Badge>
                                      </TableCell>
                                      <TableCell className='text-sm'>
                                          {t('launch_settings_summary', {
                                              count: r.question_count,
                                              minutes: Math.round(r.duration_sec / 60),
                                          })}
                                          <span className='text-muted-foreground'>
                                              {' · '}
                                              {r.pass_value}
                                              {r.pass_type === 'percent' ? '%' : ` ${t('points_suffix')}`}
                                          </span>
                                      </TableCell>
                                      <TableCell className='text-sm tabular-nums'>
                                          {r.passed_count != null && r.active_count != null
                                              ? t('launch_students_summary', {
                                                    finished: r.session_count - r.active_count,
                                                    students: r.session_count,
                                                    passed: r.passed_count,
                                                })
                                              : '—'}
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
    );
}
