import { setRequestLocale } from 'next-intl/server';
import { BlogsListClient } from './blogs-list-client';

/**
 * BLG-01 — server-component shell that mounts BlogsListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request.
 */
export const dynamic = 'force-dynamic';

export default async function BlogsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <BlogsListClient />;
}
