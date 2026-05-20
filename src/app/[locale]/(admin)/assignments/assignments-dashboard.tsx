'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAssignmentsAnalytics } from '@/lib/assignments/api';
import type { AssignmentAnalytics } from '@/lib/assignments/types';

interface StatCardProps {
    label: string;
    value: string | number;
    tone?: 'default' | 'warning' | 'success';
}

function StatCard({ label, value, tone = 'default' }: StatCardProps) {
    const toneClass =
        tone === 'warning'
            ? 'text-orange-600'
            : tone === 'success'
            ? 'text-emerald-600'
            : 'text-foreground';
    return (
        <Card>
            <CardContent className='p-4'>
                <div className='text-xs uppercase tracking-wide text-muted-foreground'>{label}</div>
                <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
            </CardContent>
        </Card>
    );
}

function formatRate(r: number | null): string {
    if (r == null) return '—';
    return `${Math.round(r * 100)}%`;
}

function formatNumber(n: number | null, digits = 1): string {
    if (n == null) return '—';
    return n.toFixed(digits);
}

interface AssignmentsDashboardProps {
    /** Optional — when provided, scopes analytics to one assignment. */
    assignmentId?: number;
}

export function AssignmentsDashboard({ assignmentId }: AssignmentsDashboardProps) {
    const t = useTranslations('admin.assignments');

    const { data, isLoading, error } = useQuery<AssignmentAnalytics>({
        queryKey: ['admin.assignments.analytics', assignmentId ?? null],
        queryFn: () => getAssignmentsAnalytics(assignmentId),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className='h-20 w-full' />
                ))}
            </div>
        );
    }
    if (error || !data) {
        // Silent fallback — analytics is a nice-to-have, not blocking.
        return null;
    }

    return (
        <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {assignmentId == null ? (
                    <StatCard label={t('dashboard_active')} value={data.active_count} tone='success' />
                ) : null}
                {assignmentId == null ? (
                    <StatCard label={t('dashboard_inactive')} value={data.inactive_count} />
                ) : null}
                <StatCard
                    label={t('dashboard_pending_review')}
                    value={data.pending_review_count}
                    tone={data.pending_review_count > 0 ? 'warning' : 'default'}
                />
                <StatCard label={t('dashboard_submissions_30d')} value={data.submissions_30d} />
                <StatCard label={t('dashboard_completion_rate')} value={formatRate(data.completion_rate)} />
                <StatCard label={t('dashboard_avg_grade')} value={formatNumber(data.avg_grade)} />
                <StatCard
                    label={t('dashboard_deadline_missed')}
                    value={data.deadline_missed_count}
                    tone={data.deadline_missed_count > 0 ? 'warning' : 'default'}
                />
                <StatCard
                    label={t('dashboard_time_to_grade')}
                    value={formatNumber(data.time_to_grade_median_hours)}
                />
            </div>

            <Card>
                <CardContent className='p-4'>
                    <div className='mb-2 text-xs uppercase tracking-wide text-muted-foreground'>
                        {t('dashboard_sparkline_title')}
                    </div>
                    <div className='h-32'>
                        <ResponsiveContainer width='100%' height='100%'>
                            <BarChart data={data.sparkline}>
                                <XAxis
                                    dataKey='bucket'
                                    tickFormatter={(v: number) => new Date(v * 1000).toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })}
                                    tick={{ fontSize: 10 }}
                                    interval='preserveStartEnd'
                                />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                                <RechartsTooltip
                                    labelFormatter={(value) => {
                                        const n = typeof value === 'number' ? value : Number(value);
                                        if (!Number.isFinite(n)) return '';
                                        return new Date(n * 1000).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Bar dataKey='submissions' fill='#3b82f6' radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
