'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getTrainerAttemptAnswers } from '@/lib/trainers/api';
import type { TrainerAttemptAnswer } from '@/lib/trainers/types';
import { cn } from '@/lib/utils';

interface AttemptAnswersDialogProps {
    attemptId: string | null;
    onOpenChange: (open: boolean) => void;
}

function outcomeVariant(outcome: string): 'success' | 'destructive' | 'muted' {
    if (outcome === 'correct') return 'success';
    if (outcome === 'incorrect') return 'destructive';
    return 'muted';
}

/**
 * Разбор попытки тренажёра: по каждому вопросу видно, что выбрал ученик и что
 * было верным. Раньше в админке были только агрегаты по попытке, и разобрать
 * конкретную ошибку было негде.
 *
 * Только просмотр: тренажёр проверяется автоматически по эталону из снапшота,
 * ручного пересмотра оценки здесь нет — в отличие от развёрнутых ответов теста.
 */
export function AttemptAnswersDialog({ attemptId, onOpenChange }: AttemptAnswersDialogProps) {
    const t = useTranslations('admin.trainers');

    const detail = useQuery({
        queryKey: ['admin.trainers.attempt-answers', attemptId],
        queryFn: () => getTrainerAttemptAnswers(attemptId as string),
        enabled: attemptId != null,
        staleTime: 30_000,
    });

    const data = detail.data;

    return (
        <Dialog open={attemptId != null} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('answers_title')}</DialogTitle>
                    <DialogDescription>
                        {data
                            ? [
                                  data.user?.full_name || data.user?.email || (data.user ? `#${data.user.id}` : '—'),
                                  t('answers_score', { score: data.score, max: data.max_score }),
                                  t('answers_rounds', { rounds: data.rounds_played }),
                              ].join(' · ')
                            : t('answers_loading')}
                    </DialogDescription>
                </DialogHeader>

                {detail.isLoading ? (
                    <div className='space-y-3'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className='h-24 w-full' />
                        ))}
                    </div>
                ) : detail.isError ? (
                    <p className='text-destructive text-sm'>{t('answers_error')}</p>
                ) : !data || data.answers.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>{t('answers_empty')}</p>
                ) : (
                    <div className='space-y-4'>
                        {data.answers.map((answer) => (
                            <AnswerCard key={answer.question_id} answer={answer} outcomeLabel={t(`answers_outcome_${answer.outcome}`)} />
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AnswerCard({ answer, outcomeLabel }: { answer: TrainerAttemptAnswer; outcomeLabel: string }) {
    return (
        <div className='space-y-2 rounded-lg border p-4'>
            <div className='flex items-start justify-between gap-3'>
                <p className='text-sm font-medium'>
                    {answer.position + 1}. {answer.title}
                </p>
                <div className='flex shrink-0 items-center gap-2'>
                    <Badge variant={outcomeVariant(answer.outcome)}>{outcomeLabel}</Badge>
                    <span className='text-muted-foreground text-xs tabular-nums'>
                        {answer.points_awarded} / {answer.points_possible}
                    </span>
                </div>
            </div>

            <ul className='space-y-1'>
                {answer.options.map((option) => (
                    <li
                        key={option.id}
                        className={cn(
                            'flex items-center gap-2 rounded px-2 py-1 text-sm',
                            option.is_correct && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                            option.is_chosen && !option.is_correct && 'bg-destructive/10 text-destructive',
                        )}
                    >
                        {option.is_correct ? (
                            <Check className='size-4 shrink-0' />
                        ) : option.is_chosen ? (
                            <X className='size-4 shrink-0' />
                        ) : (
                            <span className='size-4 shrink-0' />
                        )}
                        <span>{option.title}</span>
                        {option.is_chosen ? <span className='text-muted-foreground text-xs'>←</span> : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
