import { setRequestLocale } from 'next-intl/server';
import { StoriesListClient } from './stories-list-client';

/**
 * STY-01 — server-component shell that mounts StoriesListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request.
 */
export const dynamic = 'force-dynamic';

export default async function StoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <StoriesListClient />;
}
