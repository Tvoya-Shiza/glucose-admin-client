import { setRequestLocale } from 'next-intl/server';
import { CategoriesClient } from './categories-client';

/**
 * STY-02 — story categories sub-page (Plan 02). Admin-only CRUD.
 */
export const dynamic = 'force-dynamic';

export default async function StoryCategoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CategoriesClient />;
}
