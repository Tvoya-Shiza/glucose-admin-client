'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { CreditSessionStatus } from '@/lib/credits/types';

/**
 * Result badge for a session row: terminal statuses fold into passed/failed,
 * non-terminal statuses show their own label (pending / in_progress / cancelled).
 */
export function ResultStatusBadge({ status, passed }: { status: CreditSessionStatus; passed: boolean | null }) {
    const t = useTranslations('admin.credits');
    if (status === 'finished' || status === 'expired') {
        return passed ? (
            <Badge variant='success'>{t('result_passed')}</Badge>
        ) : (
            <Badge variant='destructive'>
                {t('result_failed')}
                {status === 'expired' ? ` · ${t('session_status_expired')}` : ''}
            </Badge>
        );
    }
    if (status === 'in_progress') return <Badge variant='info'>{t('session_status_in_progress')}</Badge>;
    if (status === 'cancelled') return <Badge variant='muted'>{t('session_status_cancelled')}</Badge>;
    return <Badge variant='outline'>{t('session_status_pending')}</Badge>;
}
