import { setRequestLocale } from 'next-intl/server';
import { ResultTextsClient } from './result-texts-client';

/** Phase 34 — server shell for the credit result-texts settings page. */
export const dynamic = 'force-dynamic';

export default async function CreditResultTextsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ResultTextsClient />;
}
