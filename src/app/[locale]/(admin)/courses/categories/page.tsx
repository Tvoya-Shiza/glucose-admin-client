import { setRequestLocale } from 'next-intl/server';
import { CourseCategoriesClient } from './course-categories-client';

/**
 * /kz/courses/categories — flat-list management surface for WebinarCategory.
 * Mirrors the server-shell pattern from the parent `/kz/courses` page.
 */
export const dynamic = 'force-dynamic';

export default async function CourseCategoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CourseCategoriesClient />;
}
