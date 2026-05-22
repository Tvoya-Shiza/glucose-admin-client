import { setRequestLocale } from 'next-intl/server';
import { ResultsPageClient } from './results-page-client';

/**
 * QZ-08 + QZ-09 + QZ-10 — server-component shell for the cross-quiz audit page.
 *
 * `force-dynamic` because the client uses TanStack Query against
 * `/api/auth/me`, `/api/proxy/v1/admin/quiz-results`, and
 * `/api/proxy/v1/admin/quiz-results/stats` — all require runtime cookies.
 *
 * Server-side RBAC enforces:
 *   - admin   → cross-quiz audit + global analytics
 *   - curator → narrowed to own groups' members
 *   - teacher → narrowed to own webinars (top_groups is empty)
 */
export const dynamic = 'force-dynamic';

export default async function QuizResultsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ResultsPageClient />;
}
