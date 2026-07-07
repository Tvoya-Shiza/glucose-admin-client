import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CreditDetailClient } from './credit-detail-client';

/**
 * Phase 34 — thin server shell for the credit detail page. Credit ids are
 * BigInt-as-STRING — validated as a digit string, never Number()-coerced.
 */
export const dynamic = 'force-dynamic';

export default async function CreditDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    if (!/^\d+$/.test(id)) notFound();
    return <CreditDetailClient creditId={id} />;
}
