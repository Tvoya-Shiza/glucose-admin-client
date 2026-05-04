'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import { listResults } from '@/lib/quizzes/api';
import type { QuizResultRow, QuizResultStatus, SortOrder } from '@/lib/quizzes/types';
import { ResultsFilters, type ResultsFiltersValue } from './results-filters';

export interface ResultsListProps {
    /**
     * When set, force `quiz_id` filter to this value and hide the quiz column +
     * quiz/badge filter inputs. Used by the per-quiz Results tab.
     *
     * When undefined, render unscoped (admin cross-quiz audit page) — quiz column
     * + quiz_id input + badge_id input are visible.
     */
    scopedQuizId?: number;
    hideQuizColumn?: boolean;
}

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

/**
 * QZ-08 + QZ-09 — reusable Results list (Plan 07).
 *
 * Consumed by:
 *   1. ResultsTab on /[locale]/quizzes/[id]?tab=results — passes scopedQuizId.
 *   2. Standalone /[locale]/quizzes/results page — no scope, admin cross-quiz audit.
 *
 * Server-side RBAC narrows visibility regardless of UI:
 *   - admin → all results
 *   - curator → narrowed to own group's user results
 *   - teacher → narrowed to own webinar's quiz results (manual two-step in service)
 *
 * is_stale_version Badge surfaces the QZ-06 invariant: when admin force-confirmed
 * a destructive edit, in-flight attempts have quiz_version_at_start < quiz.version.
 * The orange "Устаревшая версия" Badge with a tooltip showing the version delta
 * makes this visible at a glance to the admin reviewing the attempt.
 */
export function ResultsList({ scopedQuizId, hideQuizColumn }: ResultsListProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale() as 'ru' | 'kz';

    const [
        { page, page_size, status, date_from, date_to, q, quiz_id, badge_id },
        setQ,
    ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        date_from: parseAsInteger,
        date_to: parseAsInteger,
        q: parseAsString,
        quiz_id: parseAsInteger,
        badge_id: parseAsInteger,
    });

    // When scopedQuizId is provided, force the quiz_id filter regardless of URL state.
    const effectiveQuizId = scopedQuizId ?? quiz_id ?? undefined;

    const queryKey = useMemo(
        () =>
            [
                'admin.quiz-results.list',
                {
                    page,
                    page_size,
                    status,
                    date_from,
                    date_to,
                    q,
                    quiz_id: effectiveQuizId,
                    badge_id: scopedQuizId == null ? badge_id : null,
                },
            ] as const,
        [page, page_size, status, date_from, date_to, q, effectiveQuizId, badge_id, scopedQuizId],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listResults({
                page,
                page_size,
                status: (status as QuizResultStatus | null) ?? undefined,
                date_from: date_from ?? undefined,
                date_to: date_to ?? undefined,
                q: q ?? undefined,
                quiz_id: effectiveQuizId ?? undefined,
                badge_id: scopedQuizId == null ? (badge_id ?? undefined) : undefined,
                sort: 'created_at',
                order: 'desc' as SortOrder,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: QuizResultRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const filtersValue: ResultsFiltersValue = {
        q: q ?? undefined,
        status: (status as QuizResultStatus | null) ?? undefined,
        date_from: date_from ?? undefined,
        date_to: date_to ?? undefined,
        quiz_id: scopedQuizId == null ? (quiz_id ?? undefined) : undefined,
        badge_id: scopedQuizId == null ? (badge_id ?? undefined) : undefined,
    };

    const showQuizColumn = !hideQuizColumn && scopedQuizId == null;
    // Title col + (User) + Status + Score + StartVer + Created = 5 cols base.
    const columnCount = 5 + (showQuizColumn ? 1 : 0);

    return (
        <TooltipProvider>
            <div className='flex flex-col gap-3'>
                <ResultsFilters
                    value={filtersValue}
                    showQuizFilter={scopedQuizId == null}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            date_from: next.date_from ?? null,
                            date_to: next.date_to ?? null,
                            quiz_id: scopedQuizId == null ? (next.quiz_id ?? null) : null,
                            badge_id: scopedQuizId == null ? (next.badge_id ?? null) : null,
                        })
                    }
                />

                {error ? (
                    <div className='rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
                        {(error as Error).message || t('generic_error')}
                    </div>
                ) : !isLoading && rows.length === 0 ? (
                    <div className='text-muted-foreground rounded border border-dashed p-8 text-center text-sm'>
                        {t('no_results_yet')}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {showQuizColumn ? <TableHead>{t('result_col_quiz')}</TableHead> : null}
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
                                          <TableCell colSpan={columnCount}>
                                              <Skeleton className='h-6 w-full' />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((r) => {
                                      const quizTitle =
                                          locale === 'kz'
                                              ? (r.quiz?.kz_title?.trim() || r.quiz?.title_ru?.trim() || '')
                                              : (r.quiz?.title_ru?.trim() || '');
                                      const quizLabel =
                                          quizTitle.length > 0 ? quizTitle : r.quiz ? `#${r.quiz.id}` : '—';
                                      const userLabel =
                                          r.user?.full_name?.trim() || r.user?.email?.trim() || (r.user ? `#${r.user.id}` : '—');
                                      const userEmail =
                                          r.user?.full_name && r.user?.email ? r.user.email : null;

                                      return (
                                          <TableRow key={r.id}>
                                              {showQuizColumn ? (
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
                                              ) : null}
                                              <TableCell>
                                                  <div className='flex flex-col gap-0.5'>
                                                      <span className='text-sm'>{userLabel}</span>
                                                      {userEmail ? (
                                                          <span className='text-muted-foreground text-xs'>
                                                              {userEmail}
                                                          </span>
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
                                                      <span className='tabular-nums'>
                                                          {r.quiz_version_at_start ?? '—'}
                                                      </span>
                                                      {r.is_stale_version &&
                                                      r.quiz_version_at_start != null &&
                                                      r.quiz != null ? (
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
                    <span className='text-muted-foreground'>
                        {isFetching ? t('loading') : `${total}`}
                    </span>
                    <div className='flex items-center gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            disabled={page <= 1}
                            onClick={() => setQ({ page: page - 1 })}
                        >
                            ‹
                        </Button>
                        <span className='tabular-nums'>{page}</span>
                        <Button
                            variant='outline'
                            size='sm'
                            disabled={rows.length < page_size}
                            onClick={() => setQ({ page: page + 1 })}
                        >
                            ›
                        </Button>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
