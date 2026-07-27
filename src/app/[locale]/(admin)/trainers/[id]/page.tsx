import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { TrainerDetailClient } from './trainer-detail-client';

/**
 * Phase 38 — server-component shell that mounts TrainerDetailClient.
 *
 * Thin locale-locking shell (mirrors quizzes/[id]/page.tsx): a non-integer or
 * non-positive id short-circuits to notFound() before the client mounts, sparing
 * a 404 round-trip to admin-api. `force-dynamic` because the client uses nuqs +
 * TanStack Query against `/api/auth/me`.
 */
export const dynamic = 'force-dynamic';

export default async function TrainerDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const trainerId = Number(id);
    if (!Number.isInteger(trainerId) || trainerId <= 0) notFound();
    return <TrainerDetailClient trainerId={trainerId} />;
}
