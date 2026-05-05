'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminKpi } from '@/lib/analytics/api';
import { CompletionChart } from '../components/completion-chart';
import { KpiCard } from '../components/kpi-card';
import { RevenueChart } from '../components/revenue-chart';
import { SnapshotStaleness } from '../components/snapshot-staleness';

/**
 * Phase 9 ANL-01 / ANL-04 (D-11, D-13, D-14, D-15, D-16) — admin KPI view.
 *
 * Fetches /admin-api/v1/admin/analytics/admin-kpi via the BFF proxy, renders:
 *   - 7 KPI tiles (total users, 24h DAU, 7d active, course completion %,
 *     test attempts, test completion %, current-month revenue).
 *   - 12-month revenue bar chart.
 *   - 30-day completion-rate line chart.
 *   - Snapshot staleness banner (5min cache awareness).
 *
 * Failure posture: on network/5xx errors the view renders a graceful inline
 * error block — does NOT crash the dashboard shell (per plan acceptance).
 *
 * staleTime 60s — TanStack dedupes refetches across mounts; the server-side
 * cache is 5min so a stale-time of 60s gives operators a fresh view per minute
 * without hammering admin-api.
 */
export function AdminKpiView() {
    const t = useTranslations('admin.dashboard');
    const locale = useLocale();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['analytics.admin-kpi'],
        queryFn: () => getAdminKpi(),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className='space-y-6'>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4'>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className='h-24' />
                    ))}
                </div>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <Skeleton className='h-72' />
                    <Skeleton className='h-72' />
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return <p className='text-destructive'>{t('load_failed')}</p>;
    }

    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const fmt = new Intl.NumberFormat(intlLocale);
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
    // Decimal-as-string → Number for display only. KZT volumes safely under
    // MAX_SAFE_INTEGER (T-09-05-03 doc).
    const fmtKzt = (s: string) => `${fmt.format(Number(s))} ₸`;

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <h2 className='text-xl font-semibold'>{t('kpi_title')}</h2>
                <SnapshotStaleness snapshotAt={data.snapshot_at} />
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4'>
                <KpiCard label={t('kpi_total_users')} value={fmt.format(data.total_users)} />
                <KpiCard label={t('kpi_active_users_24h')} value={fmt.format(data.active_users_24h)} />
                <KpiCard label={t('kpi_active_users_7d')} value={fmt.format(data.active_users_7d)} />
                <KpiCard label={t('kpi_completion_rate_30d')} value={fmtPct(data.completion_rate_30d)} />
                <KpiCard label={t('kpi_test_attempts')} value={fmt.format(data.test_attempts_30d)} />
                <KpiCard
                    label={t('kpi_test_completion_rate')}
                    value={fmtPct(data.test_completion_rate_30d)}
                />
                <KpiCard
                    label={t('kpi_revenue_current_month')}
                    value={fmtKzt(data.revenue_current_month)}
                />
            </div>

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('chart_revenue_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RevenueChart
                            data={data.revenue_trend_12m}
                            locale={locale}
                            titleY={t('chart_revenue_y')}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('chart_completion_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CompletionChart
                            data={data.completion_trend_30d}
                            titleY={t('chart_completion_y')}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
