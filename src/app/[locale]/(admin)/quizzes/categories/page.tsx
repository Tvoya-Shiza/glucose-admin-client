import { setRequestLocale } from 'next-intl/server';
import { CategoriesTreeClient } from './categories-tree-client';

/**
 * QZ-04 — server-component shell that mounts the recursive QuizCategory tree
 * editor. `force-dynamic` because TanStack Query hits `/api/auth/me` and
 * `/api/proxy/v1/admin/quiz-categories` — both require runtime cookies.
 */
export const dynamic = 'force-dynamic';

export default async function QuizCategoriesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CategoriesTreeClient />;
}
