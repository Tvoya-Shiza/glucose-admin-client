'use client';

import { useTranslations } from 'next-intl';
import { ResultsList } from '../[id]/components/results-list';

/**
 * QZ-08 + QZ-09 — client wrapper for the standalone Results audit page.
 *
 * Renders the reusable ResultsList WITHOUT scopedQuizId so the quiz column +
 * quiz/badge filter inputs are visible. Designed primarily for admin review:
 * curator/teacher actors hit the same route but the server-side scope narrows
 * their data accordingly (no UI gating needed — the data IS the gate).
 */
export function ResultsListClient() {
    const t = useTranslations('admin.quizzes');

    return (
        <div className='space-y-4 p-4'>
            <div>
                <h1 className='text-2xl font-bold'>{t('results_page_title')}</h1>
                <p className='text-muted-foreground text-sm'>{t('results_page_subtitle')}</p>
            </div>
            <ResultsList />
        </div>
    );
}
