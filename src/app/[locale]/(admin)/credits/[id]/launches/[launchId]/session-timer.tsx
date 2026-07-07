'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCountdown } from '@/lib/credits/format';

export interface SessionTimerProps {
    /** remaining_sec from the LAST poll response (null unless in_progress). */
    remainingSec: number | null;
    /** TanStack `dataUpdatedAt` (ms) of that response — the countdown anchor. */
    dataUpdatedAt: number;
}

/**
 * mm:ss countdown re-anchored on every poll: deadline = dataUpdatedAt +
 * remaining_sec × 1000, ticked locally every second. Danger styling < 60 s.
 * A local zero NEVER finalizes anything — the server expires the session.
 */
export function SessionTimer({ remainingSec, dataUpdatedAt }: SessionTimerProps) {
    const t = useTranslations('admin.credits');
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (remainingSec == null) return null;

    const deadline = dataUpdatedAt + remainingSec * 1000;
    const left = Math.max(0, Math.round((deadline - now) / 1000));
    const danger = left < 60;

    return (
        <div
            className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums',
                danger ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'text-foreground'
            )}
            title={t('timer_remaining')}
        >
            <TimerIcon className={cn('h-4 w-4', danger ? 'text-destructive' : 'text-muted-foreground')} />
            {formatCountdown(left)}
        </div>
    );
}
