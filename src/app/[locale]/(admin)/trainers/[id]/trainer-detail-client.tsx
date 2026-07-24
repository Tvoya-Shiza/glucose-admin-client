'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePermission } from '@/lib/access/use-permission';
import { getTrainer, publishTrainer, TrainerPublishBlockedError } from '@/lib/trainers/api';
import type { TrainerPublishStatus, TrainerRow } from '@/lib/trainers/types';
import { DeleteTrainerDialog } from '../components/delete-trainer-dialog';
import { SettingsTab } from './tabs/settings-tab';
import { QuestionsTab } from './tabs/questions-tab';
import { ResultsTab } from './tabs/results-tab';

const TABS = ['settings', 'questions', 'results'] as const;
type TabKey = (typeof TABS)[number];

/**
 * Phase 38 — tabbed trainer detail (ТЗ §5 admin + §5.6 results).
 *
 * Tabs: Баптаулар (settings) / Сұрақтар (questions) / Нәтижелер (results) — URL
 * state via nuqs `?tab=`. Mirrors quiz-detail-client structure.
 *
 * Detail query keyed `['admin.trainers.detail', trainerId]` so the SettingsTab
 * save invalidates it after a successful update.
 *
 * The Questions tab REUSES the quizzes question editor unchanged — a trainer's id
 * IS a quizzes row, and the same `/quizzes/:id/questions` surface serves it.
 *
 * The Results tab is only rendered when the actor holds `trainers.results_view`
 * (separate from `trainers.view` that admits them to this page); a `?tab=results`
 * deep-link without it falls back to Settings.
 */
export function TrainerDetailClient({ trainerId }: { trainerId: number }) {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('settings'));

    const canPublish = usePermission('trainers.publish');
    const canDelete = usePermission('trainers.delete');
    const canResultsView = usePermission('trainers.results_view');

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.trainers.detail', trainerId],
        queryFn: () => getTrainer(trainerId),
        retry: false,
    });

    const [deleteOpen, setDeleteOpen] = useState(false);

    const publishMutation = useMutation({
        mutationFn: (next: TrainerPublishStatus) => publishTrainer(trainerId, { publish_status: next }),
        onSuccess: (result) => {
            toast.success(result.publish_status === 'public' ? t('publish_success') : t('hide_success'));
            qc.invalidateQueries({ queryKey: ['admin.trainers.detail', trainerId] });
            qc.invalidateQueries({ queryKey: ['admin.trainers.list'], exact: false });
        },
        onError: (err: unknown) => {
            if (err instanceof TrainerPublishBlockedError) {
                toast.error(t('publish_blocked', { questions: err.question_count, courses: err.course_count }));
                return;
            }
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
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

    const requestedTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'settings';
    const safeTab: TabKey = requestedTab === 'results' && !canResultsView ? 'settings' : requestedTab;

    const headerTitle = data.title_kz?.trim() || `#${data.id}`;

    // DeleteTrainerDialog accepts a TrainerRow — synthesize one from the detail
    // (mirrors the quiz-detail-client synthesis pattern).
    const synthesizedRow: TrainerRow = {
        id: data.id,
        title_kz: data.title_kz,
        category: data.category,
        question_count: data.counts.question_count,
        publish_status: data.publish_status,
        timer_enabled: data.timer_enabled,
        seconds_per_question: data.seconds_per_question,
        attempts_limit: data.attempts_limit,
        available_from: data.available_from,
        available_to: data.available_to,
        flashcards_enabled: data.flashcards_enabled,
        courses: data.courses,
        attempts_count: data.counts.attempts_count,
        created_at: data.created_at,
    };

    return (
        <TooltipProvider>
            <PageShell
                header={
                    <PageHeader
                        title={headerTitle}
                        subtitle={t('detail_subtitle', {
                            questions: data.counts.question_count,
                            attempts: data.counts.attempts_count,
                        })}
                        breadcrumbs={[{ label: t('list_title'), href: `/${locale}/trainers` }, { label: headerTitle }]}
                        badge={
                            <Badge variant={data.publish_status === 'public' ? 'success' : 'muted'}>
                                {t(`status_${data.publish_status}`)}
                            </Badge>
                        }
                        actions={
                            <>
                                {canPublish ? (
                                    <Button
                                        variant='outline'
                                        disabled={publishMutation.isPending}
                                        onClick={() => publishMutation.mutate(data.publish_status === 'public' ? 'hidden' : 'public')}
                                    >
                                        {data.publish_status === 'public' ? (
                                            <>
                                                <EyeOff className='mr-2 h-4 w-4' />
                                                {t('hide')}
                                            </>
                                        ) : (
                                            <>
                                                <Eye className='mr-2 h-4 w-4' />
                                                {t('publish')}
                                            </>
                                        )}
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
                        <TabsTrigger value='settings'>{t('settings_tab')}</TabsTrigger>
                        <TabsTrigger value='questions'>{t('questions_tab')}</TabsTrigger>
                        {canResultsView ? <TabsTrigger value='results'>{t('results_tab')}</TabsTrigger> : null}
                    </TabsList>
                    <TabsContent value='settings'>
                        <SettingsTab trainer={data} />
                    </TabsContent>
                    <TabsContent value='questions'>{safeTab === 'questions' ? <QuestionsTab trainerId={trainerId} /> : null}</TabsContent>
                    {canResultsView ? (
                        <TabsContent value='results'>{safeTab === 'results' ? <ResultsTab trainerId={trainerId} /> : null}</TabsContent>
                    ) : null}
                </Tabs>

                {canDelete ? (
                    <DeleteTrainerDialog
                        open={deleteOpen}
                        onOpenChange={setDeleteOpen}
                        trainer={synthesizedRow}
                        onDeleted={() => router.push(`/${locale}/trainers`)}
                    />
                ) : null}
            </PageShell>
        </TooltipProvider>
    );
}
