'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getUser } from '@/lib/users/api';
import { ActivityTab } from './tabs/activity-tab';
import { CoursesTab } from './tabs/courses-tab';
import { MembershipsTab } from './tabs/memberships-tab';
import { PaymentsTab } from './tabs/payments-tab';
import { ProfileTab } from './tabs/profile-tab';

const TABS = ['profile', 'memberships', 'courses', 'activity', 'payments'] as const;
type TabKey = (typeof TABS)[number];

/**
 * USR-02 — tabbed user detail client.
 *
 * Tabs (D-08): Profile / Memberships / Courses / Activity / Payments — URL state via
 * nuqs `?tab=` query param. Reload-survivable + shareable.
 *
 * Lazy-mount of ActivityTab (D-10): the activity tab only mounts when active so the
 * paginated AdminAuditLog query never fires on first paint. Other tabs render from
 * the same `useQuery` payload (single Prisma roundtrip).
 *
 * Detail query keyed by `['admin.users.detail', userId]` so child components
 * (ProfileTab, MembershipsTab) can `setQueryData` after a successful PATCH and the UI
 * updates without a roundtrip.
 */
export function UserDetailClient({ userId }: { userId: string }) {
    const t = useTranslations('admin.users');
    const locale = useLocale();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('profile'));

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.users.detail', userId],
        queryFn: () => getUser(userId),
    });

    if (isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }
    if (error || !data) {
        return <div className='p-6 text-sm text-destructive'>{t('error_generic')}</div>;
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'profile';

    return (
        <PageShell
            header={
                <PageHeader
                    title={data.full_name ?? '—'}
                    subtitle={[data.email, data.mobile].filter(Boolean).join(' · ') || '—'}
                    breadcrumbs={[
                        { label: t('list_title'), href: `/${locale}/users` },
                        { label: data.full_name ?? `#${data.id}` },
                    ]}
                />
            }
            contentClassName='space-y-4'
        >
            <Tabs value={safeTab} onValueChange={(v) => setTab(v)}>
                <TabsList variant='line' className='w-full justify-start'>
                    <TabsTrigger value='profile'>{t('tabs_profile')}</TabsTrigger>
                    <TabsTrigger value='memberships'>{t('tabs_memberships')}</TabsTrigger>
                    <TabsTrigger value='courses'>{t('tabs_courses')}</TabsTrigger>
                    <TabsTrigger value='activity'>{t('tabs_activity')}</TabsTrigger>
                    <TabsTrigger value='payments'>{t('tabs_payments')}</TabsTrigger>
                </TabsList>
                <TabsContent value='profile'>
                    <ProfileTab user={data} />
                </TabsContent>
                <TabsContent value='memberships'>
                    <MembershipsTab user={data} />
                </TabsContent>
                <TabsContent value='courses'>
                    <CoursesTab user={data} />
                </TabsContent>
                <TabsContent value='activity'>
                    {safeTab === 'activity' ? <ActivityTab userId={data.id} /> : null}
                </TabsContent>
                <TabsContent value='payments'>
                    <PaymentsTab user={data} />
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}
