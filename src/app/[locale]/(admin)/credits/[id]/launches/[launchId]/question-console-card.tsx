'use client';

import { useTranslations } from 'next-intl';
import { Check, Eye, SkipForward, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DifficultyBadge } from '@/components/credits/difficulty-badge';
import type { CreditSessionQuestionDetail } from '@/lib/credits/types';

export interface QuestionConsoleCardProps {
    question: CreditSessionQuestionDetail;
    total: number;
    /** Reference answer revealed for this position («Жауапты тексеру» clicked). */
    revealed: boolean;
    onReveal: () => void;
    onMark: (mark: 'correct' | 'incorrect') => void;
    onSkip: () => void;
    canConduct: boolean;
    busy: boolean;
}

/**
 * The current question in the conduct console. The reference answer stays
 * hidden until «Жауапты тексеру»; only then are Дұрыс/Қате enabled (skip is
 * always available). Already-marked questions re-open with the answer shown —
 * marks stay mutable until finalize.
 */
export function QuestionConsoleCard({ question, total, revealed, onReveal, onMark, onSkip, canConduct, busy }: QuestionConsoleCardProps) {
    const t = useTranslations('admin.credits');
    const answerVisible = revealed || question.mark !== 'pending';

    return (
        <Card className='p-0'>
            <CardHeader className='flex flex-row flex-wrap items-center gap-2 border-b px-4 py-3'>
                <span className='text-sm font-semibold tabular-nums'>{t('question_of', { position: question.position, total })}</span>
                <DifficultyBadge difficulty={question.difficulty} />
                <Badge variant='outline'>{t('question_score', { score: question.score })}</Badge>
                {question.mark !== 'pending' ? (
                    <Badge variant={question.mark === 'correct' ? 'success' : question.mark === 'incorrect' ? 'destructive' : 'muted'}>
                        {t(`mark_${question.mark}`)}
                    </Badge>
                ) : null}
            </CardHeader>
            <CardContent className='space-y-4 px-4 py-4'>
                <p className='text-base leading-relaxed whitespace-pre-wrap'>{question.question}</p>

                {answerVisible ? (
                    <div className='rounded-md border border-brand-200 bg-brand-50 p-3 dark:border-brand-200/30 dark:bg-brand-50/10'>
                        <p className='text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase'>{t('reference_answer')}</p>
                        <p className='text-sm leading-relaxed whitespace-pre-wrap'>{question.answer}</p>
                    </div>
                ) : (
                    <Button type='button' variant='outline' onClick={onReveal} disabled={busy}>
                        <Eye className='mr-2 h-4 w-4' />
                        {t('reveal_answer')}
                    </Button>
                )}

                {canConduct ? (
                    <div className='flex flex-wrap items-center gap-2'>
                        {answerVisible ? (
                            <>
                                <Button type='button' onClick={() => onMark('correct')} disabled={busy}>
                                    <Check className='mr-2 h-4 w-4' />
                                    {t('mark_correct_action')}
                                </Button>
                                <Button type='button' variant='destructive' onClick={() => onMark('incorrect')} disabled={busy}>
                                    <X className='mr-2 h-4 w-4' />
                                    {t('mark_incorrect_action')}
                                </Button>
                            </>
                        ) : null}
                        <Button type='button' variant='ghost' onClick={onSkip} disabled={busy}>
                            <SkipForward className='mr-2 h-4 w-4' />
                            {t('skip_action')}
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
