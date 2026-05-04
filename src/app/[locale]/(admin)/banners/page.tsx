import { setRequestLocale } from 'next-intl/server';
import { BannersListClient } from './banners-list-client';

/**
 * BAN-01 — server-component shell that mounts BannersListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request.
 */
export const dynamic = 'force-dynamic';

export default async function BannersPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <BannersListClient />;
}
