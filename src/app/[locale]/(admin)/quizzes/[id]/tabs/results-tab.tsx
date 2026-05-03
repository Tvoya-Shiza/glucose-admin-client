'use client';

import { useTranslations } from 'next-intl';

/**
 * Results tab — Plan 04 placeholder.
 *
 * Plan 07 (Wave 5) replaces the body wholesale with the QuizResult list with
 * RBAC-aware filters (admin all; curator narrowed to own group; teacher narrowed
 * to own webinar). The placeholder exists so QuizDetailClient's Tabs primitive
 * has a real component to render until Plan 07 lands.
 */
export function ResultsTab({ quizId: _quizId }: { quizId: number }) {
    const t = useTranslations('admin.quizzes');
    return (
        <div
            data-testid='results-tab-placeholder'
            className='text-muted-foreground p-8 text-center text-sm'
        >
            {t('results_tab_placeholder')}
        </div>
    );
}
