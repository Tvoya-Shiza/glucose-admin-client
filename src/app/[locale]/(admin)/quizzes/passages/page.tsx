import { setRequestLocale } from 'next-intl/server';
import { QuizPassagesClient } from './passages-client';

/**
 * Справочник контекстов (phase-53). `force-dynamic`, как у тем и категорий:
 * TanStack Query ходит в `/api/auth/me` и `/api/proxy/v1/admin/quiz-passages`,
 * обоим нужны cookie на каждом запросе.
 */
export const dynamic = 'force-dynamic';

export default async function QuizPassagesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <QuizPassagesClient />;
}
