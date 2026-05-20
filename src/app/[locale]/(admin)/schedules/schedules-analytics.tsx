'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getScheduleAnalytics } from '@/lib/schedules/api';
import type { ScheduleFiltersValue } from './schedules-filters';

interface SchedulesAnalyticsProps {
    filters: ScheduleFiltersValue;
}

export function SchedulesAnalytics({ filters }: SchedulesAnalyticsProps) {
    const t = useTranslations('admin.schedules');
    const locale = useLocale();

    const { data, isLoading } = useQuery({
        queryKey: ['admin.schedules.analytics', filters.from ?? null, filters.to ?? null],
        queryFn: () => getScheduleAnalytics({ from: filters.from, to: filters.to }),
        placeholderData: (prev) => prev,
    });

    const sparklineData = (data?.sparkline ?? []).map((p) => ({
        date: new Date(p.bucket * 1000).toLocaleDateString(locale === 'kz' ? 'kk-KZ' : 'ru-RU', {
            month: 'short',
            day: 'numeric',
        }),
        count: p.count,
    }));

    return (
        <div className='space-y-4'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4'>
                <StatCard
                    icon={ListChecks}
                    label={t('analytics_total')}
                    value={isLoading ? null : data?.total ?? 0}
                />
                <StatCard
                    icon={CalendarClock}
                    label={t('analytics_upcoming_7d')}
                    value={isLoading ? null : data?.upcoming_7d ?? 0}
                />
                <StatCard
                    icon={AlertTriangle}
                    label={t('analytics_overdue')}
                    value={isLoading ? null : data?.overdue_count ?? 0}
                    tone='destructive'
                />
                <StatCard
                    icon={CheckCircle2}
                    label={t('analytics_completed')}
                    value={isLoading ? null : data?.by_status.completed ?? 0}
                    tone='success'
                />
            </div>

            <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
                <Card className='p-4'>
                    <h3 className='mb-3 text-sm font-semibold'>{t('analytics_by_status')}</h3>
                    <div className='space-y-2 text-sm'>
                        {(['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
                            <div key={s} className='flex items-center justify-between border-b border-border/50 py-1.5'>
                                <span>{t(`status_${s}`)}</span>
                                <span className='font-medium tabular-nums'>{data?.by_status[s] ?? 0}</span>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card className='p-4'>
                    <h3 className='mb-3 text-sm font-semibold'>{t('analytics_by_kind')}</h3>
                    <div className='space-y-2 text-sm'>
                        {(['lesson', 'quiz', 'assignment', 'file'] as const).map((k) => (
                            <div key={k} className='flex items-center justify-between border-b border-border/50 py-1.5'>
                                <span>{t(`kind_${k}`)}</span>
                                <span className='font-medium tabular-nums'>{data?.by_kind[k] ?? 0}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className='p-4'>
                <h3 className='mb-3 text-sm font-semibold'>{t('analytics_sparkline')}</h3>
                <div className='h-48 w-full'>
                    {isLoading ? (
                        <Skeleton className='h-full w-full' />
                    ) : (
                        <ResponsiveContainer width='100%' height='100%'>
                            <BarChart data={sparklineData}>
                                <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
                                <XAxis dataKey='date' fontSize={11} />
                                <YAxis fontSize={11} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey='count' fill='currentColor' className='fill-primary' />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            <Card className='p-4'>
                <h3 className='mb-3 text-sm font-semibold'>{t('analytics_top_curators')}</h3>
                {isLoading ? (
                    <Skeleton className='h-32 w-full' />
                ) : (data?.top_curators ?? []).length === 0 ? (
                    <p className='text-sm text-muted-foreground'>—</p>
                ) : (
                    <ol className='space-y-1.5 text-sm'>
                        {data?.top_curators.map((c, idx) => (
                            <li key={c.curator_id} className='flex items-center justify-between'>
                                <span>
                                    <span className='mr-2 inline-block w-5 text-right text-muted-foreground'>
                                        {idx + 1}.
                                    </span>
                                    {c.curator_name ?? `#${c.curator_id}`}
                                </span>
                                <span className='font-medium tabular-nums'>{c.count}</span>
                            </li>
                        ))}
                    </ol>
                )}
            </Card>
        </div>
    );
}

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: number | null;
    tone?: 'default' | 'success' | 'destructive';
}

function StatCard({ icon: Icon, label, value, tone = 'default' }: StatCardProps) {
    const colorClass =
        tone === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'destructive'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-foreground';
    return (
        <Card className='p-4'>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Icon className='h-3.5 w-3.5' />
                {label}
            </div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${colorClass}`}>
                {value === null ? <Skeleton className='inline-block h-7 w-16' /> : value}
            </div>
        </Card>
    );
}
