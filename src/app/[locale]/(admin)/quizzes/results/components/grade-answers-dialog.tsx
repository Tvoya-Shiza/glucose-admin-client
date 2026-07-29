'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getResultAnswers, gradeResultAnswer } from '@/lib/quizzes/api';
import type { QuizResultAnswerRow } from '@/lib/quizzes/types';

export interface GradeAnswersDialogProps {
    resultId: number | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * Phase 45 — ручная проверка развёрнутых ответов.
 *
 * Точное совпадение с эталоном засчитывается автоматически ещё при сдаче, сюда
 * попадает остальное: опечатки, другая формулировка, неверный ответ. Решение
 * бинарное — засчитать или нет; частичного балла у вопроса нет.
 */
export function GradeAnswersDialog({ resultId, onOpenChange }: GradeAnswersDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const detail = useQuery({
        queryKey: ['admin.quiz-results.answers', resultId],
        queryFn: () => getResultAnswers(resultId!),
        enabled: resultId != null,
    });

    const mutation = useMutation({
        mutationFn: ({ questionId, verdict }: { questionId: number; verdict: 'correct' | 'incorrect' }) =>
            gradeResultAnswer(resultId!, questionId, { verdict }),
        onSuccess: () => {
            toast.success(t('grade_saved'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-results.answers', resultId] });
            // Список и сводка показывают балл и признак «ждёт проверки».
            qc.invalidateQueries({ queryKey: ['admin.quiz-results.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.quiz-results.stats'], exact: false });
        },
        onError: (err: unknown) => toast.error(err instanceof Error ? err.message : t('generic_error')),
    });

    const data = detail.data;

    return (
        <Dialog open={resultId != null} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('grade_dialog_title')}</DialogTitle>
                    <DialogDescription>
                        {data
                            ? `${data.user?.full_name ?? data.user?.email ?? '—'} · ${data.quiz?.title_kz ?? '—'} · ${data.user_grade}/${data.max_grade}`
                            : t('grade_dialog_hint')}
                    </DialogDescription>
                </DialogHeader>

                {detail.isLoading ? (
                    <div className='space-y-3'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className='h-24 w-full rounded-lg' />
                        ))}
                    </div>
                ) : detail.error ? (
                    <p className='text-destructive text-sm'>{(detail.error as Error).message}</p>
                ) : (
                    <div className='space-y-3'>
                        {(data?.answers ?? []).map((answer) => (
                            <AnswerCard
                                key={answer.question_id}
                                answer={answer}
                                busy={mutation.isPending}
                                onGrade={(verdict) => mutation.mutate({ questionId: answer.question_id, verdict })}
                            />
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AnswerCard({
    answer,
    busy,
    onGrade,
}: {
    answer: QuizResultAnswerRow;
    busy: boolean;
    onGrade: (verdict: 'correct' | 'incorrect') => void;
}) {
    const t = useTranslations('admin.quizzes');
    // Кнопки только у развёрнутых: выбор из вариантов проверен автоматически и
    // однозначно, вмешиваться в него нельзя.
    const gradable = answer.correct_answer !== null;

    return (
        <div className='rounded-lg border p-3'>
            <div className='flex items-start justify-between gap-3'>
                <p className='text-sm font-medium'>{answer.title_kz ?? `#${answer.question_id}`}</p>
                <Badge variant={answer.status === 'correct' ? 'default' : answer.status === 'incorrect' ? 'destructive' : 'secondary'}>
                    {t(`grade_status_${answer.status}`)}
                </Badge>
            </div>

            <dl className='mt-2 space-y-1 text-sm'>
                <div className='flex gap-2'>
                    <dt className='text-muted-foreground shrink-0'>{t('grade_student_answer')}:</dt>
                    <dd className='break-words'>{answer.user_answer?.trim() || '—'}</dd>
                </div>
                {gradable ? (
                    <div className='flex gap-2'>
                        <dt className='text-muted-foreground shrink-0'>{t('grade_expected_answer')}:</dt>
                        <dd className='break-words'>{answer.correct_answer?.trim() || '—'}</dd>
                    </div>
                ) : null}
            </dl>

            {gradable ? (
                <div className='mt-3 flex items-center gap-2'>
                    <Button size='sm' disabled={busy} onClick={() => onGrade('correct')}>
                        <Check className='size-4' /> {t('grade_mark_correct')}
                    </Button>
                    <Button size='sm' variant='outline' disabled={busy} onClick={() => onGrade('incorrect')}>
                        <X className='size-4' /> {t('grade_mark_incorrect')}
                    </Button>
                    <span className='text-muted-foreground ml-auto text-xs tabular-nums'>
                        {answer.grade} / {answer.max_grade}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
