'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { getGroup } from '@/lib/groups/api';
import { statusBadgeVariant } from '@/lib/groups/format';
import { DeleteGroupDialog } from '../components/delete-group-dialog';
import { MembersTab } from './tabs/members-tab';
import { OverviewTab } from './tabs/overview-tab';
import { ScheduleTab } from './tabs/schedule-tab';

const TABS = ['overview', 'members', 'schedule'] as const;
type TabKey = (typeof TABS)[number];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * GRP-05 + GRP-06 — tabbed group detail client.
 *
 * Tabs (CONTEXT D-05): Overview / Members / Schedule — URL state via nuqs `?tab=`
 * query param. Reload-survivable + shareable. Mirrors Phase 3 user-detail-client.tsx
 * structure.
 *
 * Detail query keyed by `['admin.groups.detail', groupId]` so child components
 * (OverviewTab, EditGroupForm, SupervisorChangeDialog) can `setQueryData` after a
 * successful mutation and the UI updates without a roundtrip.
 *
 * 403 handling: per Plan 03 admin-api detail service, a curator hitting another
 * curator's group receives 403 (not 404). The `getGroup` wrapper throws an Error
 * with status text; we surface the dedicated forbidden_scope copy when the message
 * carries '403'.
 *
 * Members tab is lazy-mounted (only renders when active) — Plan 04 will replace its
 * body with a paginated member list, and we don't want that query firing on first paint.
 * Schedule tab is statically mounted (cheap placeholder).
 */
export function GroupDetailClient({ groupId }: { groupId: number }) {
    const t = useTranslations('admin.groups');
    const locale = useLocale();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('overview'));

    // Role detection — drives admin-only buttons in OverviewTab.
    const me = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const role = me.data?.data?.role_name ?? 'curator';

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.groups.detail', groupId],
        queryFn: () => getGroup(groupId),
        retry: false,
    });

    const [deleteOpen, setDeleteOpen] = useState(false);

    if (isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (error || !data) {
        const msg = error instanceof Error ? error.message : '';
        const isForbidden = msg.includes('403');
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>{isForbidden ? t('forbidden_scope') : t('error_generic')}</AlertTitle>
                    {!isForbidden ? <AlertDescription>{msg}</AlertDescription> : null}
                </Alert>
            </div>
        );
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'overview';

    return (
        <PageShell
            header={
                <PageHeader
                    title={data.name}
                    subtitle={`${t('col_members')}: ${data.member_count}`}
                    breadcrumbs={[
                        { label: t('list_title'), href: `/${locale}/groups` },
                        { label: data.name },
                    ]}
                    badge={
                        <Badge variant={statusBadgeVariant(data.status)}>
                            {data.status === 'active' ? t('status_active') : t('status_inactive')}
                        </Badge>
                    }
                    actions={
                        role === 'admin' ? (
                            <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
                                {t('delete')}
                            </Button>
                        ) : null
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Tabs value={safeTab} onValueChange={(v) => setTab(v)}>
                <TabsList variant='line' className='w-full justify-start'>
                    <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                    <TabsTrigger value='members'>{t('members_tab')}</TabsTrigger>
                    <TabsTrigger value='schedule'>{t('schedule_tab')}</TabsTrigger>
                </TabsList>
                <TabsContent value='overview'>
                    <OverviewTab group={data} role={role} />
                </TabsContent>
                <TabsContent value='members'>
                    {safeTab === 'members' ? <MembersTab groupId={data.id} /> : null}
                </TabsContent>
                <TabsContent value='schedule'>
                    <ScheduleTab />
                </TabsContent>
            </Tabs>

            {role === 'admin' ? (
                <DeleteGroupDialog open={deleteOpen} onOpenChange={setDeleteOpen} groupId={data.id} />
            ) : null}
        </PageShell>
    );
}
