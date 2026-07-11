import { setRequestLocale } from 'next-intl/server';
import { CreditResultsClient } from './results-list-client';

/**
 * Cross-credit results page (item 9) — server-component shell.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime request access. Mirrors credits/page.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function CreditResultsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CreditResultsClient />;
}
