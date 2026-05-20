import { setRequestLocale } from 'next-intl/server';
import { SchedulesPageClient } from './schedules-page-client';

/**
 * Lesson schedules page — server shell that mounts SchedulesPageClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me`. Same posture as the assignments + courses pages.
 */
export const dynamic = 'force-dynamic';

export default async function SchedulesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <SchedulesPageClient />;
}
