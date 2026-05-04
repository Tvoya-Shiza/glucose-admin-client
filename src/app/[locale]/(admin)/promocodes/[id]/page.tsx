import { setRequestLocale } from 'next-intl/server';
import { PromocodeDetailClient } from './promocode-detail-client';

/**
 * PRM-01 / PRM-02 — server-component shell for promocode detail/edit page.
 *
 * `force-dynamic`: TanStack Query hits the BFF proxy + `/api/auth/me`.
 */
export const dynamic = 'force-dynamic';

export default async function PromocodeDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const promocodeId = Number(id);
    if (!Number.isFinite(promocodeId) || promocodeId <= 0) {
        return <div className='p-6 text-sm text-destructive'>Invalid promocode id.</div>;
    }
    return <PromocodeDetailClient promocodeId={promocodeId} />;
}
