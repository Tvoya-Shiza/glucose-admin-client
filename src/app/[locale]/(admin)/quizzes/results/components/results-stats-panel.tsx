'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/app/[locale]/(admin)/dashboard/components/kpi-card';
import { SnapshotStaleness } from '@/app/[locale]/(admin)/dashboard/components/snapshot-staleness';
import type { ResultsStatsResponse } from '@/lib/quizzes/types';
import { ResultsTrendChart } from './results-trend-chart';
import { TopGroupsTable } from './top-groups-table';
import { TopQuizzesTable } from './top-quizzes-table';

export interface ResultsStatsPanelProps {
    data?: ResultsStatsResponse;
    isLoading: boolean;
    isError: boolean;
    hideTopQuizzes: boolean;
    hideTopGroups: boolean;
}

/**
 * KPI tiles + daily trend chart + two ranking tables.
 *
 * Loading: skeleton grid. Error: inline destructive banner — the panel never
 * crashes the page. `hideTopQuizzes` is set when a single quiz is selected
 * (the ranking would just be that quiz); `hideTopGroups` covers teacher role
 * (no group concept) and explicit group_id filter.
 */
export function ResultsStatsPanel({ data, isLoading, isError, hideTopQuizzes, hideTopGroups }: ResultsStatsPanelProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const fmt = new Intl.NumberFormat(intlLocale);
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

    if (isLoading) {
        return (
            <div className='space-y-6'>
                <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className='h-24' />
                    ))}
                </div>
                <Skeleton className='h-72 w-full' />
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                    <Skeleton className='h-64' />
                    <Skeleton className='h-64' />
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <Card className='p-4'>
                <p className='text-sm text-destructive'>{t('results_stats_load_failed')}</p>
            </Card>
        );
    }

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-end'>
                <SnapshotStaleness snapshotAt={data.snapshot_at} />
            </div>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6'>
                <KpiCard label={t('results_stats_kpi_total')} value={fmt.format(data.totals.total)} />
                <KpiCard label={t('results_stats_kpi_passed')} value={fmt.format(data.totals.passed)} />
                <KpiCard label={t('results_stats_kpi_failed')} value={fmt.format(data.totals.failed)} />
                <KpiCard label={t('results_stats_kpi_waiting')} value={fmt.format(data.totals.waiting)} />
                <KpiCard label={t('results_stats_kpi_pass_rate')} value={fmtPct(data.totals.pass_rate)} />
                <KpiCard
                    label={t('results_stats_kpi_avg_grade')}
                    value={data.totals.avg_grade == null ? '—' : data.totals.avg_grade.toFixed(1)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('results_stats_chart_daily_title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResultsTrendChart
                        data={data.daily_trend}
                        locale={locale}
                        labels={{
                            passed: t('result_status_passed'),
                            failed: t('result_status_failed'),
                            waiting: t('result_status_waiting'),
                        }}
                    />
                </CardContent>
            </Card>

            {!hideTopQuizzes || !hideTopGroups ? (
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                    {!hideTopQuizzes ? <TopQuizzesTable rows={data.top_quizzes} /> : null}
                    {!hideTopGroups ? <TopGroupsTable rows={data.top_groups} /> : null}
                </div>
            ) : null}
        </div>
    );
}
