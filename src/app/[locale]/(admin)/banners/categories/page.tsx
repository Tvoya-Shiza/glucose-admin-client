import { setRequestLocale } from 'next-intl/server';
import { CategoriesClient } from './categories-client';

/**
 * BAN-02 — banner categories sub-page (Plan 03). Admin-only CRUD.
 */
export const dynamic = 'force-dynamic';

export default async function BannerCategoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CategoriesClient />;
}
