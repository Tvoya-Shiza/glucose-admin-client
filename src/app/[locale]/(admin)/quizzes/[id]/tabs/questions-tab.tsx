'use client';

import { useTranslations } from 'next-intl';

/**
 * Questions tab — Plan 04 placeholder.
 *
 * Plan 05 (Wave 4) replaces the body wholesale with the dnd-kit question editor +
 * Tiptap rich-text + identificative-pair UI + force-confirm dialog flow. The
 * placeholder exists so:
 *   1. The Tabs primitive in QuizDetailClient has a real component to render — no
 *      "undefined" tab content while waves 4 / 5 land.
 *   2. data-testid='questions-tab-placeholder' lets manual QA verify the
 *      placeholder is present (and Plan 05 verify the placeholder is GONE).
 */
export function QuestionsTab({ quizId: _quizId }: { quizId: number }) {
    const t = useTranslations('admin.quizzes');
    return (
        <div
            data-testid='questions-tab-placeholder'
            className='text-muted-foreground p-8 text-center text-sm'
        >
            {t('questions_tab_placeholder')}
        </div>
    );
}
