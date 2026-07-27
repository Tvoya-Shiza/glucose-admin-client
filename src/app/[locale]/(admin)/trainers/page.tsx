import { setRequestLocale } from 'next-intl/server';
import { TrainersListClient } from './trainers-list-client';

/**
 * Phase 38 — server-component shell that mounts TrainersListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Mirrors the
 * quizzes list page posture.
 */
export const dynamic = 'force-dynamic';

export default async function TrainersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <TrainersListClient />;
}
