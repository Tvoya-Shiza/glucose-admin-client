import { setRequestLocale } from 'next-intl/server';
import { EbooksListClient } from './ebooks-list-client';

/**
 * Phase 39/40 — server-component shell that mounts EbooksListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Mirrors the
 * trainers list page posture.
 */
export const dynamic = 'force-dynamic';

export default async function EbooksPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <EbooksListClient />;
}
