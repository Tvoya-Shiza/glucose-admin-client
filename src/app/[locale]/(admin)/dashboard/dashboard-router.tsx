'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { AsRolePivot, PIVOT_ROLES, type PivotRole } from './components/as-role-pivot';
import { AdminKpiView } from './views/admin-kpi-view';
import { CuratorOverviewView } from './views/curator-overview-view';
import { TeacherOverviewView } from './views/teacher-overview-view';

/**
 * Phase 9 ANL-01..04 (D-11, D-19) — role-routed dashboard router.
 *
 * Reuses the existing TanStack Query key `['auth.me']` (set by Phase 2 login
 * dashboard placeholder) so we share the cache entry — no extra network call.
 *
 * Effective view rule (T-09-05-01 mitigation):
 *   effective = actorRole === 'admin' ? pivot : actorRole
 * Non-admin URL pivots are ignored — `?as_role=admin` typed by a curator is a
 * no-op. Server endpoints also gate by @Roles, so even a manipulated client
 * cannot fetch admin data.
 *
 * Logout button retained from the previous placeholder dashboard so the
 * existing flow keeps working (no separate logout UI elsewhere yet).
 */
interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

export function DashboardRouter() {
    const t = useTranslations('admin.dashboard');
    const tShell = useTranslations('dashboard');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

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
        actorRole === 'admin' || actorRole === 'curator' || actorRole === 'teacher'
            ? actorRole
            : 'admin';
    const [pivot] = useQueryState('as_role', parseAsStringLiteral(PIVOT_ROLES).withDefault(fallbackPivot));

    // Effective view: admin pivots; curator/teacher always see their own surface.
    const effective: PivotRole | undefined =
        actorRole === 'admin'
            ? pivot
            : actorRole === 'curator' || actorRole === 'teacher'
              ? actorRole
              : undefined;

    const logout = useMutation({
        mutationFn: async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        },
        onSuccess: () => {
            qc.clear();
            router.replace(`/${locale}/login`);
        },
    });

    if (isLoading) {
        return <Skeleton className='h-72 w-full' />;
    }

    if (!actorRole) {
        return <p className='text-muted-foreground'>{t('empty')}</p>;
    }

    return (
        <div className='space-y-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-muted-foreground text-sm'>
                    {tShell('welcome')}, {me?.data?.email ?? '—'} ({tShell('role')}: {actorRole})
                </p>
                <div className='flex items-center gap-3'>
                    {actorRole === 'admin' && <AsRolePivot actorRole={actorRole} />}
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => logout.mutate()}
                        disabled={logout.isPending}
                    >
                        {tShell('logout')}
                    </Button>
                </div>
            </div>
            {effective === 'admin' && <AdminKpiView />}
            {effective === 'curator' && <CuratorOverviewView />}
            {effective === 'teacher' && <TeacherOverviewView />}
        </div>
    );
}
