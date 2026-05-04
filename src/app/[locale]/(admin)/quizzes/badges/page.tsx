import { setRequestLocale } from 'next-intl/server';
import { BadgesListClient } from './badges-list-client';

/**
 * QZ-05 — server-component shell for the QuizBadge ("Пробное ЕНТ") list.
 *
 * `force-dynamic` because TanStack Query hits `/api/auth/me` and
 * `/api/proxy/v1/admin/quiz-badges` — both require runtime cookies.
 */
export const dynamic = 'force-dynamic';

export default async function QuizBadgesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <BadgesListClient />;
}
