'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { AsRolePivot, PIVOT_ROLES, type PivotRole } from './components/as-role-pivot';
import { AdminKpiView } from './views/admin-kpi-view';
import { CuratorOverviewView } from './views/curator-overview-view';
import { TeacherOverviewView } from './views/teacher-overview-view';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

export function DashboardRouter() {
    const t = useTranslations('admin.dashboard');
    const tShell = useTranslations('dashboard');

    const { data: me, isLoading } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 60_000,
    });

    const actorRole = me?.data?.role_name;

    const fallbackPivot: PivotRole =
        actorRole === 'admin' || actorRole === 'curator' || actorRole === 'teacher' ? actorRole : 'admin';
    const [pivot] = useQueryState('as_role', parseAsStringLiteral(PIVOT_ROLES).withDefault(fallbackPivot));

    const effective: PivotRole | undefined =
        actorRole === 'admin'
            ? pivot
            : actorRole === 'curator' || actorRole === 'teacher'
              ? actorRole
              : undefined;

    if (isLoading) {
        return (
            <div className='space-y-4'>
                <Skeleton className='h-9 w-64' />
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                    <Skeleton className='h-28 w-full' />
                    <Skeleton className='h-28 w-full' />
                    <Skeleton className='h-28 w-full' />
                    <Skeleton className='h-28 w-full' />
                </div>
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (!actorRole) {
        return <p className='text-muted-foreground'>{t('empty')}</p>;
    }

    return (
        <div className='space-y-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                    <span>
                        {tShell('welcome')},{' '}
                        <span className='font-medium text-foreground'>{me?.data?.email ?? '—'}</span>
                    </span>
                    <Badge variant='success' className='capitalize'>
                        {actorRole}
                    </Badge>
                </div>
                {actorRole === 'admin' && <AsRolePivot actorRole={actorRole} />}
            </div>
            {effective === 'admin' && <AdminKpiView />}
            {effective === 'curator' && <CuratorOverviewView />}
            {effective === 'teacher' && <TeacherOverviewView />}
        </div>
    );
}
