'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CreditLaunchSessionSummary, CreditSessionStatus } from '@/lib/credits/types';

export interface SessionListPanelProps {
    sessions: CreditLaunchSessionSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

function StatusChip({ session }: { session: CreditLaunchSessionSummary }) {
    const t = useTranslations('admin.credits');
    const status: CreditSessionStatus = session.status;
    if (status === 'in_progress') {
        return (
            <Badge variant='info' className='animate-pulse'>
                {t('session_status_in_progress')}
            </Badge>
        );
    }
    if (status === 'finished' || status === 'expired') {
        return session.passed ? (
            <Badge variant='success'>{t('result_passed')}</Badge>
        ) : (
            <Badge variant='destructive'>{t('result_failed')}</Badge>
        );
    }
    if (status === 'cancelled') return <Badge variant='muted'>{t('session_status_cancelled')}</Badge>;
    return <Badge variant='outline'>{t('session_status_pending')}</Badge>;
}

/**
 * LEFT console pane — one row per session (student, live status chip,
 * answered/total, running score). Selection is lifted to nuqs `?session=`.
 */
export function SessionListPanel({ sessions, selectedId, onSelect }: SessionListPanelProps) {
    const t = useTranslations('admin.credits');

    return (
        <Card className='h-fit p-2'>
            <p className='text-muted-foreground px-2 pt-1 pb-2 text-xs font-semibold tracking-wider uppercase'>
                {t('students_panel_title')}
            </p>
            <div className='space-y-1'>
                {sessions.length === 0 ? (
                    <p className='text-muted-foreground px-2 pb-2 text-sm'>{t('empty_sessions')}</p>
                ) : (
                    sessions.map((s) => (
                        <button
                            key={s.id}
                            type='button'
                            onClick={() => onSelect(s.id)}
                            className={cn(
                                'w-full rounded-md border px-3 py-2 text-left transition-colors',
                                selectedId === s.id ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/60'
                            )}
                        >
                            <span className='flex items-center justify-between gap-2'>
                                <span className='truncate text-sm font-medium'>{s.student.full_name}</span>
                                <StatusChip session={s} />
                            </span>
                            <span className='text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs tabular-nums'>
                                <span>{t('answered_of', { answered: s.answered_count, total: s.question_count })}</span>
                                <span>{t('points_of', { score: s.score_so_far, max: s.max_score })}</span>
                            </span>
                        </button>
                    ))
                )}
            </div>
        </Card>
    );
}
