import { setRequestLocale } from 'next-intl/server';
import { SaleDetailClient } from './sale-detail-client';

/**
 * PAY-02 / D-06 — server-component shell that mounts SaleDetailClient.
 *
 * Mirrors users/[id]/page.tsx: the (admin) route-group layout already wraps
 * every authed route in <AdminShell>; this page sets the request locale for
 * next-intl/server and hands the sale id over to the client component (which
 * owns TanStack Query + the refund dialog).
 */
export default async function SaleDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    return <SaleDetailClient saleId={id} />;
}
