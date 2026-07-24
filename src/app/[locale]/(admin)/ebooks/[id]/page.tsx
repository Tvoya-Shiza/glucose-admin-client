import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { BookDetailClient } from './book-detail-client';

/**
 * Phase 39/40 — server-component shell that mounts BookDetailClient.
 *
 * Thin locale-locking shell (mirrors trainers/[id]/page.tsx): a non-integer or
 * non-positive id short-circuits to notFound() before the client mounts, sparing
 * a 404 round-trip to admin-api. `force-dynamic` because the client uses nuqs +
 * TanStack Query against `/api/auth/me`.
 */
export const dynamic = 'force-dynamic';

export default async function BookDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId <= 0) notFound();
    return <BookDetailClient bookId={bookId} />;
}
