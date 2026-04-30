import { setRequestLocale } from 'next-intl/server';
import { GroupDetailClient } from './group-detail-client';

/**
 * GRP-05 + GRP-06 — server-component shell that mounts GroupDetailClient.
 *
 * The (admin) route-group layout already wraps every authed route in <AdminShell>;
 * this page just sets the request locale for next-intl/server and hands the group id
 * over to the client component (which owns TanStack Query + nuqs tab state + tabs).
 *
 * `force-dynamic`: the client uses `nuqs` (which calls `useSearchParams()` internally)
 * and TanStack Query against `/api/auth/me` — both require runtime access to the
 * request. Mirrors /[locale]/groups/page.tsx (Plan 02).
 */
export const dynamic = 'force-dynamic';

export default async function GroupDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const groupId = Number(id);
    return <GroupDetailClient groupId={groupId} />;
}
