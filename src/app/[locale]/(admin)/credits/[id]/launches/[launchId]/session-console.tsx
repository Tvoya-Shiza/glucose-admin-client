'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Flag, Pause, Play, TimerReset, UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/lib/access/use-permission';
import {
    CreditApiError,
    extendCreditSession,
    finishCreditSession,
    getCreditSession,
    markCreditSessionQuestion,
    pauseCreditSession,
    resumeCreditSession,
    setCreditSessionCurrent,
    startCreditSession,
} from '@/lib/credits/api';
import type { CreditSessionDetail, CreditSessionQuestionDetail } from '@/lib/credits/types';
import { QuestionConsoleCard } from './question-console-card';
import { SessionProgressStrip } from './session-progress-strip';
import { SessionTimer } from './session-timer';

export interface SessionConsoleProps {
    sessionId: string;
    creditId: string;
    launchId: string;
    /** Another session of this launch is in_progress — «Бастау» disabled with a hint. */
    anotherInProgress: boolean;
    nextPendingSessionId: string | null;
    onSelectSession: (id: string) => void;
}

function isTerminal(status: CreditSessionDetail['status']): boolean {
    return status === 'finished' || status === 'expired' || status === 'cancelled';
}

/** Next position still marked `pending` after `fromPos` (wrap-around), or null. */
function nextUnmarkedPosition(questions: CreditSessionQuestionDetail[], fromPos: number): number | null {
    const sorted = [...questions].sort((a, b) => a.position - b.position);
    const after = sorted.find((q) => q.position > fromPos && q.mark === 'pending');
    if (after) return after.position;
    const wrapped = sorted.find((q) => q.mark === 'pending' && q.position !== fromPos);
    return wrapped ? wrapped.position : null;
}

/**
 * RIGHT console pane for one session. pending → student card + «Бастау»;
 * in_progress → question card + progress strip + timer + «Аяқтау»;
 * finished/expired → inline result + «Келесі студент».
 *
 * Mutation responses carry the FULL fresh session detail → setQueryData
 * (contract decision); 409 session_expired/session_finished → toast + refetch.
 */
/** Шаг продления одним нажатием. Диалог с вводом числа посреди устного зачёта
 *  куратор не откроет — ему нужно смотреть на ученика, а не на форму. */
const EXTEND_STEP_SEC = 5 * 60;

export function SessionConsole({
    sessionId,
    creditId,
    launchId,
    anotherInProgress,
    nextPendingSessionId,
    onSelectSession,
}: SessionConsoleProps) {
    const t = useTranslations('admin.credits');
    const qc = useQueryClient();
    const canConduct = usePermission('credits.conduct');

    const sessionKey = ['admin.credits.session', sessionId] as const;
    const launchKey = ['admin.credits.launch', creditId, launchId] as const;

    const [revealed, setRevealed] = useState<Set<number>>(new Set());
    const [finishOpen, setFinishOpen] = useState(false);

    const { data, dataUpdatedAt, isLoading, error } = useQuery({
        queryKey: sessionKey,
        queryFn: () => getCreditSession(sessionId),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status && isTerminal(status) ? false : 2000;
        },
        refetchIntervalInBackground: true,
        staleTime: 0,
        retry: false,
    });

    const applySession = (session: CreditSessionDetail) => {
        qc.setQueryData(sessionKey, session);
        qc.invalidateQueries({ queryKey: launchKey });
    };

    const onMutationError = (err: unknown) => {
        if (err instanceof CreditApiError) {
            const known: Record<string, string> = {
                'credits.session_expired': t('error_session_expired'),
                'credits.session_finished': t('error_session_finished'),
                'credits.active_session_exists': t('error_active_session_exists'),
            };
            const msg = known[err.code];
            if (msg) {
                toast.error(msg);
                qc.invalidateQueries({ queryKey: sessionKey });
                qc.invalidateQueries({ queryKey: launchKey });
                return;
            }
        }
        toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
    };

    const startMutation = useMutation({
        mutationFn: () => startCreditSession(sessionId),
        onSuccess: applySession,
        onError: onMutationError,
    });

    const currentMutation = useMutation({
        mutationFn: (position: number) => setCreditSessionCurrent(sessionId, position),
        onSuccess: applySession,
        onError: onMutationError,
    });

    const markMutation = useMutation({
        mutationFn: (vars: { position: number; mark: 'correct' | 'incorrect' | 'skipped' }) =>
            markCreditSessionQuestion(sessionId, vars.position, vars.mark),
        onSuccess: (session, vars) => {
            applySession(session);
            // Auto-advance to the next unmarked position (wrap-around).
            if (session.status === 'in_progress') {
                const next = nextUnmarkedPosition(session.questions, vars.position);
                if (next != null && next !== session.current_position) currentMutation.mutate(next);
            }
        },
        onError: onMutationError,
    });

    const pauseMutation = useMutation({
        mutationFn: () => pauseCreditSession(sessionId),
        onSuccess: applySession,
        onError: onMutationError,
    });

    const resumeMutation = useMutation({
        mutationFn: () => resumeCreditSession(sessionId),
        onSuccess: applySession,
        onError: onMutationError,
    });

    const extendMutation = useMutation({
        mutationFn: (seconds: number) => extendCreditSession(sessionId, seconds),
        onSuccess: applySession,
        onError: onMutationError,
    });

    const finishMutation = useMutation({
        mutationFn: () => finishCreditSession(sessionId),
        onSuccess: (session) => {
            setFinishOpen(false);
            applySession(session);
        },
        onError: (err: unknown) => {
            setFinishOpen(false);
            onMutationError(err);
        },
    });

    if (isLoading) {
        return (
            <div className='space-y-3'>
                <Skeleton className='h-10 w-1/2' />
                <Skeleton className='h-64 w-full' />
            </div>
        );
    }

    if (error || !data) {
        const msg = error instanceof Error ? error.message : '';
        return (
            <Alert variant='destructive'>
                <AlertTitle>{t('generic_error')}</AlertTitle>
                <AlertDescription>{msg}</AlertDescription>
            </Alert>
        );
    }

    const busy =
        markMutation.isPending ||
        currentMutation.isPending ||
        finishMutation.isPending ||
        pauseMutation.isPending ||
        resumeMutation.isPending ||
        extendMutation.isPending;
    const unmarkedCount = data.questions.filter((q) => q.mark === 'pending').length;

    // ── pending ──────────────────────────────────────────────────────────────
    if (data.status === 'pending') {
        return (
            <Card className='h-fit'>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        <UserRound className='h-5 w-5' />
                        {data.student.full_name}
                    </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm'>
                        <span>{t('attempt_label', { n: data.attempt_number })}</span>
                        <span>{t('question_total_label', { count: data.questions.length })}</span>
                        <span>{t('review_minutes', { minutes: Math.round(data.duration_sec / 60) })}</span>
                    </div>
                    {canConduct ? (
                        <div className='space-y-2'>
                            <Button onClick={() => startMutation.mutate()} disabled={anotherInProgress || startMutation.isPending}>
                                <Play className='mr-2 h-4 w-4' />
                                {startMutation.isPending ? t('loading') : t('start_session')}
                            </Button>
                            {anotherInProgress ? <p className='text-muted-foreground text-xs'>{t('start_hint_other_active')}</p> : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        );
    }

    // ── in_progress ──────────────────────────────────────────────────────────
    if (data.status === 'in_progress' || data.status === 'paused') {
        const isPaused = data.status === 'paused';
        const currentQuestion = data.questions.find((q) => q.position === data.current_position) ?? data.questions[0] ?? null;
        return (
            <div className='space-y-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                        <span className='font-medium'>{data.student.full_name}</span>
                        <Badge variant='outline'>{t('attempt_label', { n: data.attempt_number })}</Badge>
                    </div>
                    <div className='flex items-center gap-2'>
                        {/* На паузе таймер не тикает: сервер отдаёт остаток, замерший
                            на моменте паузы, и dataUpdatedAt его не сдвигает. */}
                        <SessionTimer
                            remainingSec={data.remaining_sec}
                            dataUpdatedAt={isPaused ? 0 : dataUpdatedAt}
                        />
                        {canConduct ? (
                            <>
                                <Button
                                    variant='outline'
                                    onClick={() => extendMutation.mutate(EXTEND_STEP_SEC)}
                                    disabled={busy || data.remaining_sec == null}
                                    title={t('extend_hint', { minutes: EXTEND_STEP_SEC / 60 })}
                                >
                                    <TimerReset className='mr-2 h-4 w-4' />
                                    {t('extend_action', { minutes: EXTEND_STEP_SEC / 60 })}
                                </Button>
                                {isPaused ? (
                                    <Button onClick={() => resumeMutation.mutate()} disabled={busy}>
                                        <Play className='mr-2 h-4 w-4' />
                                        {t('resume_action')}
                                    </Button>
                                ) : (
                                    <Button variant='outline' onClick={() => pauseMutation.mutate()} disabled={busy}>
                                        <Pause className='mr-2 h-4 w-4' />
                                        {t('pause_action')}
                                    </Button>
                                )}
                                <Button variant='destructive' onClick={() => setFinishOpen(true)} disabled={busy}>
                                    <Flag className='mr-2 h-4 w-4' />
                                    {t('finish_action')}
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>

                {isPaused ? (
                    <Alert>
                        <Pause className='h-4 w-4' />
                        <AlertDescription>{t('paused_notice')}</AlertDescription>
                    </Alert>
                ) : null}

                <SessionProgressStrip
                    questions={data.questions}
                    currentPosition={data.current_position}
                    onNavigate={(position) => {
                        if (canConduct && position !== data.current_position) currentMutation.mutate(position);
                    }}
                    disabled={!canConduct || busy}
                />

                {currentQuestion ? (
                    <QuestionConsoleCard
                        key={currentQuestion.position}
                        question={currentQuestion}
                        total={data.questions.length}
                        revealed={revealed.has(currentQuestion.position)}
                        onReveal={() =>
                            setRevealed((prev) => {
                                const next = new Set(prev);
                                next.add(currentQuestion.position);
                                return next;
                            })
                        }
                        onMark={(mark) => markMutation.mutate({ position: currentQuestion.position, mark })}
                        onSkip={() => markMutation.mutate({ position: currentQuestion.position, mark: 'skipped' })}
                        canConduct={canConduct}
                        busy={busy}
                    />
                ) : null}

                <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>{t('finish_confirm_title')}</DialogTitle>
                            <DialogDescription>{t('finish_confirm_description', { count: unmarkedCount })}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => setFinishOpen(false)}
                                disabled={finishMutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                type='button'
                                variant='destructive'
                                onClick={() => finishMutation.mutate()}
                                disabled={finishMutation.isPending}
                            >
                                {finishMutation.isPending ? t('loading') : t('finish_action')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // ── finished / expired / cancelled ───────────────────────────────────────
    return (
        <Card className='h-fit'>
            <CardHeader>
                <CardTitle className='flex flex-wrap items-center gap-2'>
                    {data.student.full_name}
                    {data.result ? (
                        data.result.passed ? (
                            <Badge variant='success'>{t('result_passed')}</Badge>
                        ) : (
                            <Badge variant='destructive'>{t('result_failed')}</Badge>
                        )
                    ) : (
                        <Badge variant='muted'>{t(`session_status_${data.status}`)}</Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                {data.result ? (
                    <dl className='grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2'>
                        <div className='flex justify-between gap-2'>
                            <dt className='text-muted-foreground'>{t('result_score_label')}</dt>
                            <dd className='font-semibold tabular-nums'>
                                {data.result.score}/{data.result.max_score}
                            </dd>
                        </div>
                        <div className='flex justify-between gap-2'>
                            <dt className='text-muted-foreground'>{t('result_percent_label')}</dt>
                            <dd className='font-semibold tabular-nums'>{data.result.percent}%</dd>
                        </div>
                        <div className='flex justify-between gap-2'>
                            <dt className='text-muted-foreground'>{t('pass_threshold_label')}</dt>
                            <dd className='tabular-nums'>{data.result.pass_threshold}</dd>
                        </div>
                        <div className='flex justify-between gap-2'>
                            <dt className='text-muted-foreground'>{t('finish_reason_label')}</dt>
                            <dd>{t(`finish_reason_${data.result.finish_reason}`)}</dd>
                        </div>
                    </dl>
                ) : null}
                {/* Per-student motivational message for the completion screen (item 4). */}
                {data.result?.motivational_text ? (
                    <div className='rounded-md border border-brand-200 bg-brand-50 p-3 text-sm leading-relaxed dark:border-brand-200/30 dark:bg-brand-50/10'>
                        {data.result.motivational_text}
                    </div>
                ) : null}
                {nextPendingSessionId ? (
                    <Button onClick={() => onSelectSession(nextPendingSessionId)}>
                        <ArrowRight className='mr-2 h-4 w-4' />
                        {t('next_student')}
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}
