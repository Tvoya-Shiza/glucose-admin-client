import { setRequestLocale } from 'next-intl/server';
import { ResultsListClient } from './results-list-client';

/**
 * QZ-08 + QZ-09 — server-component shell for the standalone QuizResults page.
 *
 * `force-dynamic` because the underlying client uses TanStack Query against
 * `/api/auth/me` and `/api/proxy/v1/admin/quiz-results` — both require runtime
 * cookies and can't be statically rendered.
 *
 * Server-side RBAC enforces:
 *   - admin → cross-quiz audit
 *   - curator → narrowed to own group's user results
 *   - teacher → narrowed to own webinar's results
 */
export const dynamic = 'force-dynamic';

export default async function QuizResultsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ResultsListClient />;
}
