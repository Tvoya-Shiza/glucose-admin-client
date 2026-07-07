import { setRequestLocale } from 'next-intl/server';
import { RatingJournalClient } from './rating-journal-client';

/**
 * Рейтинг-журнал — server-component shell that mounts RatingJournalClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Mirrors
 * /[locale]/credits/page.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function RatingJournalPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <RatingJournalClient />;
}
