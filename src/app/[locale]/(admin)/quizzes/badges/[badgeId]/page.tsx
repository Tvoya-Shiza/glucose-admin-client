import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { BadgeDetailClient } from './badge-detail-client';

/**
 * QZ-05 — server-component shell for the QuizBadge detail page.
 * Validates :badgeId is numeric; otherwise returns 404 (Next.js notFound()).
 */
export const dynamic = 'force-dynamic';

export default async function BadgeDetailPage({
    params,
}: {
    params: Promise<{ locale: string; badgeId: string }>;
}) {
    const { locale, badgeId } = await params;
    setRequestLocale(locale);
    const id = Number.parseInt(badgeId, 10);
    if (!Number.isFinite(id) || id < 1) {
        notFound();
    }
    return <BadgeDetailClient badgeId={id} />;
}
