'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/lib/access/use-permission';
import { getCredit } from '@/lib/credits/api';
import { DeleteCreditDialog } from '../components/delete-credit-dialog';
import { LaunchWizardDialog } from '../components/launch-wizard-dialog';
import { CreditStatusBadge } from './components/credit-status-badge';
import { OverviewTab } from './tabs/overview-tab';
import { ResultsTab } from './tabs/results-tab';
import { LaunchesTab } from './tabs/launches-tab';

const TABS = ['overview', 'results', 'launches'] as const;
type TabKey = (typeof TABS)[number];

/**
 * Phase 34 — tabbed credit detail (nuqs ?tab=overview|results|launches),
 * mirrors quizzes/[id]/quiz-detail-client.tsx.
 */
export function CreditDetailClient({ creditId }: { creditId: string }) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('overview'));

    const canConduct = usePermission('credits.conduct');
    const canDelete = usePermission('credits.delete');

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.credits.detail', creditId],
        queryFn: () => getCredit(creditId),
        retry: false,
    });

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [launchOpen, setLaunchOpen] = useState(false);

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
        const isNotFound = msg.includes('404');
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>{isForbidden ? t('forbidden_scope') : isNotFound ? t('not_found') : t('generic_error')}</AlertTitle>
                    {!isForbidden && !isNotFound ? <AlertDescription>{msg}</AlertDescription> : null}
                </Alert>
            </div>
        );
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'overview';

    return (
        <PageShell
            header={
                <PageHeader
                    title={data.title}
                    subtitle={data.group?.name ?? undefined}
                    breadcrumbs={[{ label: t('list_title'), href: `/${locale}/credits` }, { label: data.title }]}
                    badge={<CreditStatusBadge status={data.status} />}
                    actions={
                        <>
                            {canConduct ? (
                                <Button onClick={() => setLaunchOpen(true)} disabled={data.status !== 'active'}>
                                    <PlayCircle className='mr-2 h-4 w-4' />
                                    {t('launch')}
                                </Button>
                            ) : null}
                            {canDelete ? (
                                <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
                                    {t('delete')}
                                </Button>
                            ) : null}
                        </>
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Tabs value={safeTab} onValueChange={(v) => setTab(v)}>
                <TabsList variant='line' className='w-full justify-start'>
                    <TabsTrigger value='overview'>{t('tab_overview')}</TabsTrigger>
                    <TabsTrigger value='results'>{t('tab_results')}</TabsTrigger>
                    <TabsTrigger value='launches'>{t('tab_launches')}</TabsTrigger>
                </TabsList>
                <TabsContent value='overview'>
                    <OverviewTab credit={data} />
                </TabsContent>
                <TabsContent value='results'>{safeTab === 'results' ? <ResultsTab creditId={creditId} /> : null}</TabsContent>
                <TabsContent value='launches'>{safeTab === 'launches' ? <LaunchesTab creditId={creditId} /> : null}</TabsContent>
            </Tabs>

            {canDelete ? (
                <DeleteCreditDialog open={deleteOpen} onOpenChange={setDeleteOpen} credit={{ id: data.id, title: data.title }} />
            ) : null}
            {canConduct ? (
                <LaunchWizardDialog open={launchOpen} onOpenChange={setLaunchOpen} creditId={data.id} creditTitle={data.title} />
            ) : null}
        </PageShell>
    );
}
