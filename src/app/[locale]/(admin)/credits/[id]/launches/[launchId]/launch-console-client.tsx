'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { MonitorPlay } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCredit, getCreditLaunch } from '@/lib/credits/api';
import type { CreditLaunchStatus } from '@/lib/credits/types';
import { SessionListPanel } from './session-list-panel';
import { SessionConsole } from './session-console';

const LAUNCH_STATUS_VARIANT: Record<CreditLaunchStatus, 'info' | 'success' | 'muted'> = {
    active: 'info',
    completed: 'success',
    cancelled: 'muted',
};

/**
 * Conduct console — two-pane (lg:grid-cols-[320px_1fr]). LEFT: session list
 * polled from getLaunch every 3 s until the launch is finished. RIGHT: the
 * selected session console (nuqs ?session=), polled every 2 s while live.
 */
export function LaunchConsoleClient({ creditId, launchId }: { creditId: string; launchId: string }) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const [sessionId, setSessionId] = useQueryState('session', parseAsString);

    const launchQuery = useQuery({
        queryKey: ['admin.credits.launch', creditId, launchId],
        queryFn: () => getCreditLaunch(creditId, launchId),
        refetchInterval: (query) => (query.state.data && query.state.data.status !== 'active' ? false : 3000),
        refetchIntervalInBackground: true,
        staleTime: 0,
    });

    const creditQuery = useQuery({
        queryKey: ['admin.credits.detail', creditId],
        queryFn: () => getCredit(creditId),
        staleTime: 60_000,
    });

    const launch = launchQuery.data;
    const sessions = useMemo(() => launch?.sessions ?? [], [launch]);

    const anotherInProgress = useMemo(() => sessions.some((s) => s.status === 'in_progress' && s.id !== sessionId), [sessions, sessionId]);
    const nextPendingSessionId = useMemo(
        () => sessions.find((s) => s.status === 'pending' && s.id !== sessionId)?.id ?? null,
        [sessions, sessionId]
    );

    if (launchQuery.isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (launchQuery.error || !launch) {
        const msg = launchQuery.error instanceof Error ? launchQuery.error.message : '';
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>{t('generic_error')}</AlertTitle>
                    <AlertDescription>{msg}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const creditTitle = creditQuery.data?.title ?? `#${creditId}`;

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('console_title', { title: creditTitle })}
                    subtitle={creditQuery.data?.group?.name ?? undefined}
                    breadcrumbs={[
                        { label: t('list_title'), href: `/${locale}/credits` },
                        { label: creditTitle, href: `/${locale}/credits/${creditId}?tab=launches` },
                        { label: t('console_breadcrumb') },
                    ]}
                    badge={<Badge variant={LAUNCH_STATUS_VARIANT[launch.status]}>{t(`launch_status_${launch.status}`)}</Badge>}
                />
            }
            contentClassName='space-y-4'
        >
            <div className='grid gap-4 lg:grid-cols-[320px_1fr]'>
                <SessionListPanel sessions={sessions} selectedId={sessionId} onSelect={(id) => setSessionId(id)} />
                {sessionId ? (
                    <SessionConsole
                        key={sessionId}
                        sessionId={sessionId}
                        creditId={creditId}
                        launchId={launchId}
                        anotherInProgress={anotherInProgress}
                        nextPendingSessionId={nextPendingSessionId}
                        onSelectSession={(id) => setSessionId(id)}
                    />
                ) : (
                    <Card className='p-0'>
                        <EmptyState icon={MonitorPlay} title={t('select_session_hint')} className='h-full border-0' />
                    </Card>
                )}
            </div>
        </PageShell>
    );
}
