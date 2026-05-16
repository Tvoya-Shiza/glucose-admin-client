'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { ResultsList } from '../[id]/components/results-list';

/**
 * QZ-08 + QZ-09 — client wrapper for the standalone Results audit page.
 */
export function ResultsListClient() {
    const t = useTranslations('admin.quizzes');

    return (
        <PageShell
            header={<PageHeader title={t('results_page_title')} subtitle={t('results_page_subtitle')} />}
            contentClassName='space-y-4'
        >
            <ResultsList />
        </PageShell>
    );
}
