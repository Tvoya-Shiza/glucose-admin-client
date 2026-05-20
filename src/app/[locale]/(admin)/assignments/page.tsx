import { setRequestLocale } from 'next-intl/server';
import { AssignmentsListClient } from './assignments-list-client';

/**
 * Assignments list page — server shell that mounts AssignmentsListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me`. Mirrors the courses + quizzes pattern.
 */
export const dynamic = 'force-dynamic';

export default async function AssignmentsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <AssignmentsListClient />;
}
