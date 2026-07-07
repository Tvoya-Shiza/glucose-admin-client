import { setRequestLocale } from 'next-intl/server';
import { QuestionsListClient } from './questions-list-client';

/** Phase 34 — server shell for the credit question bank list. */
export const dynamic = 'force-dynamic';

export default async function CreditQuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <QuestionsListClient />;
}
