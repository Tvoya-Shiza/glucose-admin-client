'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { CreditSessionQuestionDetail } from '@/lib/credits/types';

export interface SessionProgressStripProps {
    questions: CreditSessionQuestionDetail[];
    currentPosition: number | null;
    /** Clicking a chip PATCHes the session's current position. */
    onNavigate: (position: number) => void;
    disabled?: boolean;
}

/**
 * Clickable per-question chips: correct = green, incorrect = red, skipped =
 * neutral, pending = outline, current = ring.
 */
export function SessionProgressStrip({ questions, currentPosition, onNavigate, disabled }: SessionProgressStripProps) {
    const t = useTranslations('admin.credits');
    const sorted = [...questions].sort((a, b) => a.position - b.position);

    return (
        <div className='flex flex-wrap gap-1.5' aria-label={t('progress_strip_label')}>
            {sorted.map((q) => (
                <button
                    key={q.position}
                    type='button'
                    disabled={disabled}
                    onClick={() => onNavigate(q.position)}
                    aria-label={t('question_of', { position: q.position, total: sorted.length })}
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors',
                        q.mark === 'correct' && 'border-brand-200 bg-brand-50 text-brand-700',
                        q.mark === 'incorrect' && 'border-destructive/40 bg-destructive/10 text-destructive',
                        q.mark === 'skipped' && 'border-border bg-muted text-muted-foreground',
                        q.mark === 'pending' && 'border-border bg-background text-foreground',
                        q.position === currentPosition && 'ring-2 ring-primary ring-offset-1',
                        !disabled && 'hover:bg-muted/70',
                        disabled && 'cursor-default opacity-70'
                    )}
                >
                    {q.position}
                </button>
            ))}
        </div>
    );
}
