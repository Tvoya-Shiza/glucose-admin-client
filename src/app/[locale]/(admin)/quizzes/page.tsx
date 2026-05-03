import { setRequestLocale } from 'next-intl/server';
import { QuizzesListClient } from './quizzes-list-client';

/**
 * QZ-01 — server-component shell that mounts QuizzesListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Mirrors the
 * Phase 5 /[locale]/courses page.
 */
export const dynamic = 'force-dynamic';

export default async function QuizzesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <QuizzesListClient />;
}
