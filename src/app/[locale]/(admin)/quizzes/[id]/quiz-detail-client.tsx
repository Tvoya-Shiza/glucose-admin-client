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
import { TooltipProvider } from '@/components/ui/tooltip';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { getQuiz } from '@/lib/quizzes/api';
import type { QuizDetail, QuizRow } from '@/lib/quizzes/types';
import { DeleteQuizDialog } from '../components/delete-quiz-dialog';
import { DuplicateQuizButton } from '../components/duplicate-quiz-button';
import { OverviewTab } from './tabs/overview-tab';
import { QuestionsTab } from './tabs/questions-tab';
import { ResultsTab } from './tabs/results-tab';

const TABS = ['overview', 'questions', 'results'] as const;
type TabKey = (typeof TABS)[number];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * QZ-01 + QZ-08 — tabbed quiz detail client (Plan 04).
 *
 * Tabs (CONTEXT D-04): Overview / Questions / Results — URL state via nuqs `?tab=`
 * query param. Reload-survivable + shareable. Mirrors Phase 5 Plan 03
 * course-detail-client.tsx structure with one fewer tab (no Schedule for quizzes).
 *
 * Detail query keyed by `['admin.quizzes.detail', quizId]` so the OverviewTab's
 * inline saves can `setQueryData` after a successful mutation and the UI updates
 * without a roundtrip.
 *
 * 403 handling: per Plan 04 admin-api detail service, a curator hitting any quiz
 * (or a non-admin/non-teacher actor in general) receives 403, NOT 404. The
 * `getQuiz` wrapper throws an Error carrying status text; we surface the dedicated
 * forbidden_scope copy when the message carries '403'.
 *
 * Lazy-mount strategy:
 *   - Overview is always mounted (cheap inline-edit form).
 *   - Questions / Results are gated by `safeTab === '<tab>' ? <Tab /> : null` so
 *     Plans 05 / 07 are free to mount heavy queries inside their tabs without
 *     polluting first paint.
 *
 * Page header: quiz title (RU translation, fallback to `#<id>`) + version pill +
 * status Badge + Duplicate button (admin/teacher) + Delete button (admin only).
 */
export function QuizDetailClient({ quizId }: { quizId: number }) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('overview'));

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
        queryKey: ['admin.quizzes.detail', quizId],
        queryFn: () => getQuiz(quizId),
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
        const isNotFound = msg.includes('404');
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>
                        {isForbidden
                            ? t('forbidden_scope')
                            : isNotFound
                              ? t('not_found')
                              : t('generic_error')}
                    </AlertTitle>
                    {!isForbidden && !isNotFound ? <AlertDescription>{msg}</AlertDescription> : null}
                </Alert>
            </div>
        );
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'overview';

    const ruTitle = data.translations.find((tr) => tr.locale === 'kz')?.title?.trim() ?? '';
    const headerTitle = ruTitle.length > 0 ? ruTitle : `#${data.id}`;
    const isAdmin = role === 'admin';

    // DeleteQuizDialog accepts a QuizRow. Synthesize one from QuizDetail (the
    // dialog only reads `id` in practice, but we populate every QuizRow field
    // defensively for future-proofing — mirrors Phase 5 Plan 03 synthesis pattern).
    const synthesizedRow: QuizRow = {
        id: data.id,
        title_kz: data.translations.find((tr) => tr.locale === 'kz')?.title ?? null,
        status: data.status,
        version: data.version,
        category: data.category
            ? { id: data.category.id, title_kz: data.category.title_kz }
            : null,
        time: data.time,
        pass_mark: data.pass_mark,
        attempt: data.attempt,
        certificate: data.certificate,
        is_listed: data.is_listed,
        is_paid: data.is_paid,
        price: data.price,
        access_days: data.access_days,
        question_count: data.counts.question_count,
        translation_completeness: data.translation_completeness,
        missing_locales: data.missing_locales,
        badges: data.badges.map((b) => ({ id: b.id, title_kz: b.title_kz })),
        created_at: data.created_at,
        updated_at: data.updated_at,
    };

    return (
        <TooltipProvider>
            <PageShell
                header={
                    <PageHeader
                        title={headerTitle}
                        subtitle={`${t('col_questions')}: ${data.counts.question_count}`}
                        breadcrumbs={[
                            { label: t('list_title'), href: `/${locale}/quizzes` },
                            { label: headerTitle },
                        ]}
                        badge={
                            <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant={data.status === 'active' ? 'success' : 'muted'}>
                                    {data.status === 'active' ? t('status_active') : t('status_inactive')}
                                </Badge>
                                <Badge variant='outline'>{t('version_label', { n: data.version })}</Badge>
                            </div>
                        }
                        actions={
                            <>
                                {isAdmin || role === 'teacher' ? <DuplicateQuizButton quizId={data.id} /> : null}
                                {isAdmin ? (
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
                        <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                        <TabsTrigger value='questions'>{t('questions_tab')}</TabsTrigger>
                        <TabsTrigger value='results'>{t('results_tab')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value='overview'>
                        <OverviewTab quiz={data} role={role} />
                    </TabsContent>
                    <TabsContent value='questions'>
                        {safeTab === 'questions' ? <QuestionsTab quizId={quizId} /> : null}
                    </TabsContent>
                    <TabsContent value='results'>
                        {safeTab === 'results' ? <ResultsTab quizId={quizId} /> : null}
                    </TabsContent>
                </Tabs>

                {isAdmin ? (
                    <DeleteQuizDialog open={deleteOpen} onOpenChange={setDeleteOpen} quiz={synthesizedRow} />
                ) : null}
            </PageShell>
        </TooltipProvider>
    );
}
