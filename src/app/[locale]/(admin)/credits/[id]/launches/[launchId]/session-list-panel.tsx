'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CreditLaunchSessionSummary, CreditSessionStatus } from '@/lib/credits/types';

export interface SessionListPanelProps {
    sessions: CreditLaunchSessionSummary[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

/**
 * Neutral status chip — deliberately does NOT reveal the score or pass/fail so a
 * curator conducting one student can't see everyone's results at a glance (item
 * 2). A finished/expired session shows a neutral «завершён» badge; the full
 * result is seen only inside the opened session console.
 */
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
        return <Badge variant='muted'>{t('session_status_completed')}</Badge>;
    }
    if (status === 'cancelled') return <Badge variant='muted'>{t('session_status_cancelled')}</Badge>;
    return <Badge variant='outline'>{t('session_status_pending')}</Badge>;
}

// Coarse status groups. finished + expired collapse into one neutral «Аяқталды»
// bucket — matching StatusChip, so the panel never leaks pass/fail. Fixed order:
// active first, done last.
type SessionGroupKey = 'in_progress' | 'pending' | 'completed' | 'cancelled';
const GROUP_ORDER: SessionGroupKey[] = ['in_progress', 'pending', 'completed', 'cancelled'];
const GROUP_LABEL_KEY: Record<SessionGroupKey, string> = {
    in_progress: 'session_status_in_progress',
    pending: 'session_status_pending',
    completed: 'session_status_completed',
    cancelled: 'session_status_cancelled',
};

function groupOf(status: CreditSessionStatus): SessionGroupKey {
    if (status === 'in_progress') return 'in_progress';
    if (status === 'finished' || status === 'expired') return 'completed';
    if (status === 'cancelled') return 'cancelled';
    return 'pending';
}

/**
 * LEFT console pane — sessions grouped by status into collapsible sections (item
 * 2). Each row shows the student name + a NEUTRAL status only; scores / answered
 * counts / pass-fail stay hidden here and are shown only in the opened session
 * console. «Аяқталды» starts collapsed so active/pending students stay in view.
 * Selection is lifted to nuqs `?session=`.
 */
export function SessionListPanel({ sessions, selectedId, onSelect }: SessionListPanelProps) {
    const t = useTranslations('admin.credits');
    // Local UI state (per repo convention); ephemeral, not in the URL.
    const [collapsed, setCollapsed] = useState<Set<SessionGroupKey>>(() => new Set<SessionGroupKey>(['completed']));

    const groups = useMemo(() => {
        const byKey = new Map<SessionGroupKey, CreditLaunchSessionSummary[]>();
        for (const s of sessions) {
            const key = groupOf(s.status);
            const arr = byKey.get(key);
            if (arr) arr.push(s);
            else byKey.set(key, [s]);
        }
        return GROUP_ORDER.filter((k) => byKey.has(k)).map((k) => ({ key: k, items: byKey.get(k)! }));
    }, [sessions]);

    const toggle = (key: SessionGroupKey) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <Card className='h-fit p-2'>
            <p className='text-muted-foreground px-2 pt-1 pb-2 text-xs font-semibold tracking-wider uppercase'>
                {t('students_panel_title')}
            </p>
            {sessions.length === 0 ? (
                <p className='text-muted-foreground px-2 pb-2 text-sm'>{t('empty_sessions')}</p>
            ) : (
                <div className='space-y-1'>
                    {groups.map(({ key, items }) => {
                        // Keep a group open when it holds the selected session so the
                        // active row never hides under a collapsed header (a session can
                        // move buckets mid-conduct as the 3s poll refreshes statuses).
                        const holdsSelected = selectedId != null && items.some((s) => s.id === selectedId);
                        const isCollapsed = collapsed.has(key) && !holdsSelected;
                        return (
                            <div key={key}>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => toggle(key)}
                                    aria-expanded={!isCollapsed}
                                    className='text-muted-foreground h-8 w-full justify-start gap-1.5 px-2 text-xs font-medium'
                                >
                                    {isCollapsed ? <ChevronRight className='size-4' /> : <ChevronDown className='size-4' />}
                                    <span>{t(GROUP_LABEL_KEY[key])}</span>
                                    <span className='ml-auto tabular-nums'>{items.length}</span>
                                </Button>
                                {!isCollapsed ? (
                                    <div className='space-y-1 pt-1'>
                                        {items.map((s) => (
                                            <button
                                                key={s.id}
                                                type='button'
                                                onClick={() => onSelect(s.id)}
                                                className={cn(
                                                    'w-full rounded-md border px-3 py-2 text-left transition-colors',
                                                    selectedId === s.id
                                                        ? 'border-primary/40 bg-primary/5'
                                                        : 'border-transparent hover:bg-muted/60'
                                                )}
                                            >
                                                <span className='flex items-center justify-between gap-2'>
                                                    <span className='truncate text-sm font-medium'>{s.student.full_name}</span>
                                                    <StatusChip session={s} />
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
