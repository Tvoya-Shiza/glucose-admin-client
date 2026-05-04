import { setRequestLocale } from 'next-intl/server';
import { PromocodesListClient } from './promocodes-list-client';

/**
 * PRM-01 — server-component shell that mounts PromocodesListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request.
 */
export const dynamic = 'force-dynamic';

export default async function PromocodesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <PromocodesListClient />;
}
