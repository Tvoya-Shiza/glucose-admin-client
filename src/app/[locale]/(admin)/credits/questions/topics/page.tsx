import { setRequestLocale } from 'next-intl/server';
import { TopicsTreeClient } from './topics-tree-client';

/** Phase 34 — server shell for the credit topics tree editor. */
export const dynamic = 'force-dynamic';

export default async function CreditTopicsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <TopicsTreeClient />;
}
