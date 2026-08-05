import { setRequestLocale } from 'next-intl/server';
import { QuizTopicsClient } from './topics-client';

/**
 * Справочник тем тестов (phase-51). `force-dynamic`, как и у категорий:
 * TanStack Query ходит в `/api/auth/me` и `/api/proxy/v1/admin/quiz-topics`,
 * обоим нужны cookie на каждом запросе.
 */
export const dynamic = 'force-dynamic';

export default async function QuizTopicsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <QuizTopicsClient />;
}
