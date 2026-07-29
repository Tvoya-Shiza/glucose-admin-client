'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { useMe } from '@/lib/access/use-me';
import { getResultsStats, listResults } from '@/lib/quizzes/api';
import type { QuizResultStatus, SortOrder } from '@/lib/quizzes/types';
import { GradeAnswersDialog } from './components/grade-answers-dialog';
import { ResultsFiltersBar, type ResultsFiltersValue } from './components/results-filters-bar';
import { ResultsStatsPanel } from './components/results-stats-panel';
import { ResultsTable } from './components/results-table';

/**
 * QZ-08 + QZ-09 + QZ-10 — cross-quiz audit page client.
 *
 * One nuqs source of truth for filters; drives BOTH the stats query and the
 * list query so KPI/chart/rankings and the table can never disagree about
 * which slice of data is being inspected. The per-quiz Results tab uses a
 * separate `ResultsList` component and is unaffected by this layout.
 */
export function ResultsPageClient() {
    const t = useTranslations('admin.quizzes');
    const me = useMe();
    const isTeacher = me.data?.role_name === 'teacher';

    const [filters, setFilters] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        needs_grading: parseAsString,
        date_from: parseAsInteger,
        date_to: parseAsInteger,
        q: parseAsString,
        quiz_id: parseAsInteger,
        badge_id: parseAsInteger,
        group_id: parseAsInteger,
    });

    const status = (filters.status as QuizResultStatus | null) ?? undefined;
    const needsGrading = filters.needs_grading === 'true' ? ('true' as const) : undefined;
    const [gradingResultId, setGradingResultId] = useState<number | null>(null);

    const statsQueryArgs = useMemo(
        () => ({
            quiz_id: filters.quiz_id ?? undefined,
            badge_id: filters.badge_id ?? undefined,
            group_id: filters.group_id ?? undefined,
            status,
            date_from: filters.date_from ?? undefined,
            date_to: filters.date_to ?? undefined,
        }),
        [filters.quiz_id, filters.badge_id, filters.group_id, status, filters.date_from, filters.date_to],
    );

    const stats = useQuery({
        queryKey: ['admin.quiz-results.stats', statsQueryArgs],
        queryFn: () => getResultsStats(statsQueryArgs),
        staleTime: 60_000,
    });

    const listQueryArgs = useMemo(
        () => ({
            page: filters.page,
            page_size: filters.page_size,
            status,
            needs_grading: needsGrading,
            date_from: filters.date_from ?? undefined,
            date_to: filters.date_to ?? undefined,
            q: filters.q ?? undefined,
            quiz_id: filters.quiz_id ?? undefined,
            badge_id: filters.badge_id ?? undefined,
            group_id: filters.group_id ?? undefined,
            sort: 'created_at' as const,
            order: 'desc' as SortOrder,
        }),
        [
            filters.page,
            filters.page_size,
            status,
            needsGrading,
            filters.date_from,
            filters.date_to,
            filters.q,
            filters.quiz_id,
            filters.badge_id,
            filters.group_id,
        ],
    );

    const list = useQuery({
        queryKey: ['admin.quiz-results.list', listQueryArgs],
        queryFn: () => listResults(listQueryArgs),
        placeholderData: (prev) => prev,
    });

    const filtersValue: ResultsFiltersValue = {
        q: filters.q ?? undefined,
        status,
        date_from: filters.date_from ?? undefined,
        date_to: filters.date_to ?? undefined,
        quiz_id: filters.quiz_id ?? undefined,
        badge_id: filters.badge_id ?? undefined,
        group_id: filters.group_id ?? undefined,
    };

    return (
        <PageShell
            header={<PageHeader title={t('results_page_title')} subtitle={t('results_page_subtitle')} />}
            contentClassName='space-y-6'
        >
            <ResultsFiltersBar
                value={filtersValue}
                showGroupFilter={!isTeacher}
                onChange={(next) =>
                    setFilters({
                        page: 1,
                        q: next.q ?? null,
                        status: next.status ?? null,
                        date_from: next.date_from ?? null,
                        date_to: next.date_to ?? null,
                        quiz_id: next.quiz_id ?? null,
                        badge_id: next.badge_id ?? null,
                        group_id: next.group_id ?? null,
                    })
                }
            />

            {/* Быстрый переход к разбору: попытки, ждущие ручной проверки. */}
            <div className='flex items-center gap-2'>
                <Button
                    variant={needsGrading ? 'default' : 'outline'}
                    size='sm'
                    onClick={() => setFilters({ page: 1, needs_grading: needsGrading ? null : 'true' })}
                >
                    {t('results_needs_grading_filter')}
                </Button>
            </div>

            <ResultsStatsPanel
                data={stats.data}
                isLoading={stats.isLoading}
                isError={stats.isError}
                hideTopQuizzes={filters.quiz_id != null}
                hideTopGroups={filters.group_id != null || isTeacher}
            />

            <ResultsTable
                rows={list.data?.rows ?? []}
                total={list.data?.total ?? 0}
                page={filters.page}
                page_size={filters.page_size}
                isLoading={list.isLoading}
                isFetching={list.isFetching}
                error={list.error as Error | null}
                onPageChange={(next) => setFilters({ page: next })}
                onGrade={(resultId) => setGradingResultId(resultId)}
            />

            <GradeAnswersDialog resultId={gradingResultId} onOpenChange={(open) => !open && setGradingResultId(null)} />
        </PageShell>
    );
}
