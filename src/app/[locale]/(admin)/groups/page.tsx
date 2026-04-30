import { setRequestLocale } from 'next-intl/server';
import { GroupsListClient } from './groups-list-client';

/**
 * GRP-01 — server-component shell that mounts GroupsListClient.
 *
 * The (admin) route-group layout already wraps every authed route in <AdminShell>;
 * this page just sets the request locale for next-intl/server and hands over to the
 * client component (which owns TanStack Query + nuqs URL state + table + dialogs).
 *
 * `force-dynamic`: the client uses `nuqs` (which calls `useSearchParams()` internally)
 * and TanStack Query against `/api/auth/me` — both require runtime access to the request.
 * Static prerender bails out without an explicit Suspense boundary; opting the route
 * into dynamic rendering is the documented Next.js fix and keeps SSR + client hydration
 * symmetric. Auth gating in middleware.ts further enforces dynamic per-request behavior.
 */
export const dynamic = 'force-dynamic';

export default async function GroupsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <GroupsListClient />;
}
