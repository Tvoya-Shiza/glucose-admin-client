import { setRequestLocale } from 'next-intl/server';
import { CategoriesClient } from './categories-client';

/**
 * BLG-02 — blog categories sub-page (Plan 04). Admin-only CRUD.
 */
export const dynamic = 'force-dynamic';

export default async function BlogCategoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CategoriesClient />;
}
