import { setRequestLocale } from 'next-intl/server';
import { SalesListClient } from './sales-list-client';

/**
 * PAY-02 — server-component shell that mounts SalesListClient.
 *
 * Mirrors users/page.tsx + payments/page.tsx: the (admin) route-group layout
 * already wraps every authed route in <AdminShell>; this page just sets the
 * request locale for next-intl/server and hands over to the client component
 * (which owns TanStack Query + nuqs URL state + table + export button).
 */
export default async function SalesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <SalesListClient />;
}
