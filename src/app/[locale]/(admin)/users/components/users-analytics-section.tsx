'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { ChevronDown, ChevronRight, UserPlus, Users, UserCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '../../dashboard/components/kpi-card';
import { UsersRangePicker } from './users-range-picker';
import { UsersRegistrationsChart } from './users-registrations-chart';
import { UsersRoleBreakdown } from './users-role-breakdown';
import { fetchUsersAnalytics } from '@/lib/users/api';
import type { AnalyticsRange } from '@/lib/users/types';

/**
 * Collapsible analytics section mounted at the top of the users page.
 *
 * URL state (nuqs):
 *   - analytics_open: '1' | '0'  (default '1')
 *   - analytics_range: '7d' | '30d' | '90d' | '365d' | 'custom' (default '30d')
 *   - analytics_from / analytics_to: Unix seconds, only when range='custom'
 *
 * TanStack Query key:  ['admin.users.analytics', { range, from, to }]
 * staleTime: 60s — registrations data changes slowly; quick UI toggles stay snappy.
 */
export function UsersAnalyticsSection() {
    const t = useTranslations('admin.users');
    const locale = useLocale();

    const [{ analytics_open, analytics_range, analytics_from, analytics_to }, setQ] = useQueryStates({
        analytics_open: parseAsString.withDefault('1'),
        analytics_range: parseAsString.withDefault('30d'),
        analytics_from: parseAsInteger,
        analytics_to: parseAsInteger,
    });
    const open = analytics_open !== '0';
    const range = (KNOWN_RANGES as readonly string[]).includes(analytics_range)
        ? (analytics_range as AnalyticsRange)
        : '30d';
    const from = analytics_from ?? undefined;
    const to = analytics_to ?? undefined;

    const queryKey = useMemo(
        () => ['admin.users.analytics', { range, from: range === 'custom' ? from : undefined, to: range === 'custom' ? to : undefined }] as const,
        [range, from, to],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            fetchUsersAnalytics({
                range,
                from: range === 'custom' ? from : undefined,
                to: range === 'custom' ? to : undefined,
            }),
        // Custom range needs both from + to to be set; otherwise admin-api 400s.
        enabled: range !== 'custom' || (typeof from === 'number' && typeof to === 'number'),
        staleTime: 60_000,
        placeholderData: (prev) => prev,
    });

    return (
        <Card>
            <CardHeader className='flex flex-row items-center justify-between gap-2 pb-2'>
                <CardTitle className='flex items-center gap-2 text-base'>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='size-6'
                        onClick={() => setQ({ analytics_open: open ? '0' : '1' })}
                        aria-label={open ? t('analytics_collapse') : t('analytics_expand')}
                    >
                        {open ? <ChevronDown className='size-4' /> : <ChevronRight className='size-4' />}
                    </Button>
                    {t('analytics_title')}
                    {isFetching && open ? (
                        <span className='text-xs text-muted-foreground'>{t('loading')}</span>
                    ) : null}
                </CardTitle>
                {open ? (
                    <UsersRangePicker
                        range={range}
                        from={from}
                        to={to}
                        onChange={(next) =>
                            setQ({
                                analytics_range: next.range,
                                analytics_from: next.from ?? null,
                                analytics_to: next.to ?? null,
                            })
                        }
                    />
                ) : null}
            </CardHeader>
            {open ? (
                <CardContent className='space-y-4'>
                    {error ? (
                        <div className='text-sm text-destructive'>{(error as Error).message ?? t('error_generic')}</div>
                    ) : null}
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                        {isLoading && !data ? (
                            <>
                                <Skeleton className='h-28 w-full' />
                                <Skeleton className='h-28 w-full' />
                                <Skeleton className='h-28 w-full' />
                                <Skeleton className='h-28 w-full' />
                            </>
                        ) : data ? (
                            <>
                                <KpiCard
                                    label={t('kpi_total')}
                                    value={data.totals.total_users.toLocaleString()}
                                    icon={Users}
                                />
                                <KpiCard
                                    label={t('kpi_new_in_range')}
                                    value={data.totals.new_users_in_range.toLocaleString()}
                                    icon={UserPlus}
                                />
                                <KpiCard
                                    label={t('kpi_active_30d')}
                                    value={data.totals.active_users_30d.toLocaleString()}
                                    icon={UserCheck}
                                />
                                <KpiCard
                                    label={t('kpi_pending')}
                                    value={data.by_status.pending.toLocaleString()}
                                    icon={Clock}
                                />
                            </>
                        ) : null}
                    </div>
                    <div className='grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]'>
                        <Card className='p-4'>
                            <div className='mb-2 text-sm font-medium'>{t('chart_registrations')}</div>
                            {isLoading && !data ? (
                                <Skeleton className='h-72 w-full' />
                            ) : data ? (
                                <UsersRegistrationsChart
                                    data={data.registrations}
                                    bucket={data.range.bucket}
                                    locale={locale}
                                    label={t('chart_registrations')}
                                />
                            ) : null}
                        </Card>
                        <Card className='p-4'>
                            <div className='mb-2 text-sm font-medium'>{t('chart_by_role')}</div>
                            {isLoading && !data ? (
                                <Skeleton className='h-40 w-full' />
                            ) : data ? (
                                <UsersRoleBreakdown rows={data.by_role} />
                            ) : null}
                        </Card>
                    </div>
                </CardContent>
            ) : null}
        </Card>
    );
}

const KNOWN_RANGES = ['7d', '30d', '90d', '365d', 'custom'] as const;
