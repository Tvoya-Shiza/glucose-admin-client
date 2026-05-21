'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCourseAccessorsSummary } from '@/lib/course-access/api';

export interface AccessorsSummaryCardsProps {
    courseId: number;
}

/**
 * Phase 19 / Feature C — top-of-tab KPI cards: total / direct / via_group / active_7d.
 *
 * Shares the cache key with the accessors table so that mutations (grant,
 * revoke, extend) invalidate both at once.
 */
export function AccessorsSummaryCards({ courseId }: AccessorsSummaryCardsProps) {
    const t = useTranslations('admin.course_access');
    const { data, isLoading } = useQuery({
        queryKey: ['admin.course-access.accessors', courseId, 'summary'],
        queryFn: () => getCourseAccessorsSummary(courseId),
        staleTime: 30_000,
    });

    if (isLoading) {
        return (
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
            </div>
        );
    }

    const total = data?.total ?? 0;
    const direct = data?.direct_count ?? 0;
    const viaGroup = data?.via_group_count ?? 0;
    const groupsCount = data?.groups_count ?? 0;
    const active7d = data?.active_last_7d ?? 0;

    return (
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <KpiCard label={t('summary_total')} value={total} hint={t('summary_total_hint')} />
            <KpiCard label={t('summary_direct')} value={direct} hint={t('summary_direct_hint')} />
            <KpiCard
                label={t('summary_via_group')}
                value={viaGroup}
                hint={t('summary_via_group_hint', { count: groupsCount })}
            />
            <KpiCard label={t('summary_active_7d')} value={active7d} hint={t('summary_active_7d_hint')} />
        </div>
    );
}

function KpiCard({ label, value, hint }: { label: string; value: number; hint: string }) {
    return (
        <Card>
            <CardHeader className='pb-1'>
                <CardTitle className='text-xs font-medium text-muted-foreground'>{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className='text-2xl font-semibold'>{value}</p>
                <p className='mt-1 text-xs text-muted-foreground'>{hint}</p>
            </CardContent>
        </Card>
    );
}
