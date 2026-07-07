import { setRequestLocale } from 'next-intl/server';
import { CreditsListClient } from './credits-list-client';

/**
 * Phase 34 — server-component shell that mounts CreditsListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Mirrors
 * /[locale]/quizzes/page.tsx.
 */
export const dynamic = 'force-dynamic';

export default async function CreditsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CreditsListClient />;
}
