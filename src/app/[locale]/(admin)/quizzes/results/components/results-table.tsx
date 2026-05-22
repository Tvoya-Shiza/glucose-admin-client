'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import type { QuizResultRow, QuizResultStatus } from '@/lib/quizzes/types';

function statusBadgeVariant(status: QuizResultStatus): 'default' | 'secondary' | 'destructive' {
    switch (status) {
        case 'passed':
            return 'default';
        case 'waiting':
            return 'secondary';
        case 'failed':
            return 'destructive';
    }
}

export interface ResultsTableProps {
    rows: QuizResultRow[];
    total: number;
    page: number;
    page_size: number;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    onPageChange: (next: number) => void;
}

/**
 * Pure presentational table for the cross-quiz audit page — filters/pagination
 * state lives in the parent. The per-quiz Results tab continues to use
 * `quizzes/[id]/components/results-list.tsx`; this file is intentionally
 * decoupled so future analytics changes don't leak there.
 */
export function ResultsTable({ rows, total, page, page_size, isLoading, isFetching, error, onPageChange }: ResultsTableProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();

    return (
        <TooltipProvider>
            <Card className='space-y-3 p-4'>
                {error ? (
                    <div className='rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
                        {error.message || t('generic_error')}
                    </div>
                ) : !isLoading && rows.length === 0 ? (
                    <div className='text-muted-foreground rounded border border-dashed p-8 text-center text-sm'>
                        {t('no_results_yet')}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('result_col_quiz')}</TableHead>
                                <TableHead>{t('result_col_user')}</TableHead>
                                <TableHead>{t('result_col_status')}</TableHead>
                                <TableHead>{t('result_col_score')}</TableHead>
                                <TableHead>{t('result_col_start_version')}</TableHead>
                                <TableHead>{t('result_col_created')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 8 }).map((_, i) => (
                                      <TableRow key={`sk-${i}`}>
                                          <TableCell colSpan={6}>
                                              <Skeleton className='h-6 w-full' />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((r) => {
                                      const quizTitle =
                                          locale === 'kz'
                                              ? r.quiz?.kz_title?.trim() || r.quiz?.title_kz?.trim() || ''
                                              : r.quiz?.title_kz?.trim() || '';
                                      const quizLabel = quizTitle.length > 0 ? quizTitle : r.quiz ? `#${r.quiz.id}` : '—';
                                      const userLabel =
                                          r.user?.full_name?.trim() || r.user?.email?.trim() || (r.user ? `#${r.user.id}` : '—');
                                      const userEmail = r.user?.full_name && r.user?.email ? r.user.email : null;

                                      return (
                                          <TableRow key={r.id}>
                                              <TableCell>
                                                  {r.quiz ? (
                                                      <Link
                                                          href={`/${locale}/quizzes/${r.quiz.id}`}
                                                          className='hover:underline'
                                                          aria-label={t('result_quiz_link_aria')}
                                                      >
                                                          {quizLabel}
                                                      </Link>
                                                  ) : (
                                                      <span className='text-muted-foreground'>—</span>
                                                  )}
                                              </TableCell>
                                              <TableCell>
                                                  <div className='flex flex-col gap-0.5'>
                                                      <span className='text-sm'>{userLabel}</span>
                                                      {userEmail ? (
                                                          <span className='text-muted-foreground text-xs'>{userEmail}</span>
                                                      ) : null}
                                                  </div>
                                              </TableCell>
                                              <TableCell>
                                                  <Badge variant={statusBadgeVariant(r.status)}>
                                                      {t(`result_status_${r.status}`)}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell className='tabular-nums text-sm'>
                                                  {r.user_grade == null ? '—' : r.user_grade}
                                              </TableCell>
                                              <TableCell className='text-sm'>
                                                  <div className='flex flex-wrap items-center gap-2'>
                                                      <span className='tabular-nums'>{r.quiz_version_at_start ?? '—'}</span>
                                                      {r.is_stale_version && r.quiz_version_at_start != null && r.quiz != null ? (
                                                          <Tooltip>
                                                              <TooltipTrigger asChild>
                                                                  <Badge
                                                                      variant='secondary'
                                                                      className='border-amber-500/40 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                                                  >
                                                                      {t('result_stale_version_badge')}
                                                                  </Badge>
                                                              </TooltipTrigger>
                                                              <TooltipContent>
                                                                  {t('result_stale_version_tooltip', {
                                                                      start_version: r.quiz_version_at_start,
                                                                      current_version: r.quiz.version,
                                                                  })}
                                                              </TooltipContent>
                                                          </Tooltip>
                                                      ) : null}
                                                  </div>
                                              </TableCell>
                                              <TableCell className='text-sm'>
                                                  {formatUnixSecondsOrDash(r.created_at, locale)}
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                        </TableBody>
                    </Table>
                )}

                <div className='flex items-center justify-between border-t pt-3 text-sm'>
                    <span className='text-muted-foreground'>{isFetching ? t('loading') : `${total}`}</span>
                    <div className='flex items-center gap-2'>
                        <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                            ‹
                        </Button>
                        <span className='tabular-nums'>{page}</span>
                        <Button
                            variant='outline'
                            size='sm'
                            disabled={rows.length < page_size}
                            onClick={() => onPageChange(page + 1)}
                        >
                            ›
                        </Button>
                    </div>
                </div>
            </Card>
        </TooltipProvider>
    );
}
