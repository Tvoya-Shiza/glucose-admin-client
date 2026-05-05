import { setRequestLocale } from 'next-intl/server';
import { PaymentsListClient } from './payments-list-client';

/**
 * PAY-01 — server-component shell that mounts PaymentsListClient.
 *
 * Mirrors users/page.tsx: the (admin) route-group layout already wraps every
 * authed route in <AdminShell>; this page just sets the request locale for
 * next-intl/server and hands over to the client component (which owns
 * TanStack Query + nuqs URL state + table + drawer + export).
 */
export default async function PaymentsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <PaymentsListClient />;
}
