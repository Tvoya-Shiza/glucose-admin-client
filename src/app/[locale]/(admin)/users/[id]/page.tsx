import { setRequestLocale } from 'next-intl/server';
import { UserDetailClient } from './user-detail-client';

/**
 * USR-02 — server-component shell that mounts UserDetailClient.
 *
 * The (admin) route-group layout already wraps every authed route in <AdminShell>;
 * this page just sets the request locale for next-intl/server and hands the user id
 * over to the client component (which owns TanStack Query + nuqs tab state + tabs).
 *
 * Tab routing decision (D-08): nuqs `?tab=` query param (NOT a Next dynamic [tab]
 * segment). Both options were on the table — query param chosen because it keeps a
 * single page route, is easy to share/reload, and avoids segment-level hydration
 * for tab swaps.
 */
export default async function UserDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    return <UserDetailClient userId={id} />;
}
