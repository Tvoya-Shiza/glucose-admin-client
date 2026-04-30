import { setRequestLocale } from 'next-intl/server';
import { UsersListClient } from './users-list-client';

/**
 * USR-01 — server-component shell that mounts UsersListClient.
 *
 * The (admin) route-group layout already wraps every authed route in <AdminShell>;
 * this page just sets the request locale for next-intl/server and hands over to the
 * client component (which owns TanStack Query + nuqs URL state + table).
 */
export default async function UsersPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <UsersListClient />;
}
