'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Award, Search, X } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GroupPicker } from '@/components/groups/group-picker';
import { listCreditResults } from '@/lib/credits/api';
import { formatUnixDateTimeOrDash } from '@/lib/credits/format';
import type { CreditSessionStatus } from '@/lib/credits/types';
import { ResultStatusBadge } from '../[id]/components/result-status-badge';

const STATUS_ALL = 'all';
const STATUSES: CreditSessionStatus[] = ['finished', 'expired', 'in_progress', 'pending', 'cancelled'];

/**
 * Cross-credit results (item 9) — every conducted zachet attempt across all
 * credits, searchable by ФИО or phone «номер». Mirrors CreditsListClient
 * (TanStack Query + nuqs + PageShell). Read-only.
 */
export function CreditResultsClient() {
    const t = useTranslations('admin.creditResults');
    const locale = useLocale();

    const [{ page, page_size, q, group_id, status }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        group_id: parseAsInteger,
        status: parseAsString,
    });

    const queryKey = useMemo(
        () => ['admin.credit-results.list', { page, page_size, q, group_id, status }] as const,
        [page, page_size, q, group_id, status],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listCreditResults({
                page,
                page_size,
                search: q ?? undefined,
                group_id: group_id ?? undefined,
                status: (status as CreditSessionStatus | null) ?? undefined,
            }),
        staleTime: 0,
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;
    const anyFilterActive = Boolean(group_id || status || (q && q.trim().length > 0));

    return (
        <PageShell
            header={<PageHeader title={t('list_title')} subtitle={t('list_subtitle')} />}
            footer={
                rows.length > 0 || page > 1 ? (
                    <DataTablePagination
                        page={page}
                        pageSize={page_size}
                        total={total}
                        rowCount={rows.length}
                        isFetching={isFetching}
                        onPageChange={(p) => setQ({ page: p })}
                        onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                    />
                ) : null
            }
            contentClassName='space-y-4'
        >
            <Card className='p-4'>
                <div className='flex flex-wrap items-end gap-4'>
                    <div className='w-72'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('search_label')}</label>
                        <div className='relative'>
                            <Search className='text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
                            <Input
                                value={q ?? ''}
                                onChange={(e) => setQ({ page: 1, q: e.target.value || null })}
                                placeholder={t('search_placeholder')}
                                className='px-8'
                            />
                            {q ? (
                                <button
                                    type='button'
                                    onClick={() => setQ({ page: 1, q: null })}
                                    aria-label={t('search_clear')}
                                    className='text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2'
                                >
                                    <X className='h-4 w-4' />
                                </button>
                            ) : null}
                        </div>
                    </div>
                    <div className='w-64'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('group_label')}</label>
                        <GroupPicker
                            value={group_id ?? null}
                            onChange={(id) => setQ({ page: 1, group_id: id ?? null })}
                            placeholder={t('group_placeholder')}
                        />
                    </div>
                    <div className='w-48'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('status_label')}</label>
                        <Select
                            value={status ?? STATUS_ALL}
                            onValueChange={(v) => setQ({ page: 1, status: v === STATUS_ALL ? null : v })}
                        >
                            <SelectTrigger className='w-full'>
                                <SelectValue placeholder={t('status_all')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={STATUS_ALL}>{t('status_all')}</SelectItem>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {t(`status_${s}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Award} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Award} title={anyFilterActive ? t('empty_no_results') : t('empty')} />
                ) : (
                    <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-10'>#</TableHead>
                                    <TableHead>{t('col_student')}</TableHead>
                                    <TableHead>{t('col_phone')}</TableHead>
                                    <TableHead>{t('col_credit')}</TableHead>
                                    <TableHead>{t('col_group')}</TableHead>
                                    <TableHead>{t('col_date')}</TableHead>
                                    <TableHead>{t('col_score')}</TableHead>
                                    <TableHead>{t('col_status')}</TableHead>
                                    <TableHead>{t('col_attempt')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading
                                    ? Array.from({ length: 10 }).map((_, i) => (
                                          <TableRow key={`sk-${i}`}>
                                              <TableCell colSpan={9}>
                                                  <Skeleton className='h-6 w-full' />
                                              </TableCell>
                                          </TableRow>
                                      ))
                                    : rows.map((r, i) => (
                                          <TableRow key={r.session_id}>
                                              <TableCell className='text-muted-foreground text-xs tabular-nums'>
                                                  {(page - 1) * page_size + i + 1}
                                              </TableCell>
                                              <TableCell className='text-sm font-medium'>{r.student.full_name ?? '—'}</TableCell>
                                              <TableCell className='text-muted-foreground text-sm tabular-nums'>
                                                  {r.student.mobile ?? '—'}
                                              </TableCell>
                                              <TableCell className='text-sm'>
                                                  <span className='block'>{r.credit.title}</span>
                                                  {r.credit.course?.title ? (
                                                      <span className='text-muted-foreground text-xs'>{r.credit.course.title}</span>
                                                  ) : null}
                                              </TableCell>
                                              <TableCell className='text-sm'>{r.credit.group?.name ?? '—'}</TableCell>
                                              <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                                                  {formatUnixDateTimeOrDash(r.finished_at, locale)}
                                              </TableCell>
                                              <TableCell className='text-sm tabular-nums'>
                                                  {r.score == null ? (
                                                      '—'
                                                  ) : (
                                                      <>
                                                          {r.score}/{r.max_score}
                                                          {r.percent != null ? (
                                                              <span className='text-muted-foreground'> · {r.percent}%</span>
                                                          ) : null}
                                                      </>
                                                  )}
                                              </TableCell>
                                              <TableCell>
                                                  <ResultStatusBadge status={r.status} passed={r.passed} />
                                              </TableCell>
                                              <TableCell className='text-sm tabular-nums'>{r.attempt_number}</TableCell>
                                          </TableRow>
                                      ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </PageShell>
    );
}
