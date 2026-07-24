import { setRequestLocale } from 'next-intl/server';
import { PublishersListClient } from './publishers-list-client';

/**
 * Phase 39/40 — server-component shell for the publishers reference table.
 *
 * Static segment, so it wins over the sibling `/ebooks/[id]` dynamic route.
 * Publishers reuse the ebooks.* permission group (view to read, edit to mutate),
 * which the longest-prefix `/ebooks` → `ebooks.view` route mapping already covers.
 */
export const dynamic = 'force-dynamic';

export default async function PublishersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <PublishersListClient />;
}
