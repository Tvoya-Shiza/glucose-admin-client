import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { QuizDetailClient } from './quiz-detail-client';

/**
 * QZ-01 — server-component shell that mounts QuizDetailClient.
 *
 * Mirrors Phase 5 Plan 03 /[locale]/courses/[id]/page.tsx posture: thin server
 * shell that locks the request locale for next-intl/server and hands the quiz id
 * over to the client component (which owns TanStack Query + nuqs tab state + tabs).
 *
 * `force-dynamic`: the client uses `nuqs` (which calls `useSearchParams()` internally)
 * and TanStack Query against `/api/auth/me` — both require runtime access to the
 * request.
 *
 * Path-param coercion is defensive: a non-integer or non-positive id short-circuits
 * to Next.js notFound() before the client component mounts, sparing a 404 round-trip
 * to admin-api.
 */
export const dynamic = 'force-dynamic';

export default async function QuizDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const quizId = Number(id);
    if (!Number.isInteger(quizId) || quizId <= 0) notFound();
    return <QuizDetailClient quizId={quizId} />;
}
