'use client';

import { ResultsList } from '../components/results-list';

/**
 * Results tab — Plan 07 (replaces Plan 04 placeholder).
 *
 * Renders the reusable ResultsList scoped to the current quiz. The quiz column
 * is hidden because every row in this view is for the same quiz; quiz/badge
 * filter inputs are also hidden by ResultsList when scopedQuizId is provided.
 *
 * Server-side RBAC narrows visibility regardless of UI:
 *   - admin → all results for this quiz
 *   - curator → only this quiz's results from users in their group
 *   - teacher → only this quiz's results when this quiz's webinar belongs to them
 *
 * Stale-version Badge per row surfaces the QZ-06 invariant when an attempt
 * started before a force-confirmed destructive edit.
 */
export function ResultsTab({ quizId }: { quizId: number }) {
    return (
        <div className='p-4'>
            <ResultsList scopedQuizId={quizId} hideQuizColumn />
        </div>
    );
}
