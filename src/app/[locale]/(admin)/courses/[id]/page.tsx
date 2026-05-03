import { setRequestLocale } from 'next-intl/server';
import { CourseDetailClient } from './course-detail-client';

/**
 * CRS-01 + CRS-07 — server-component shell that mounts CourseDetailClient.
 *
 * The (admin) route-group layout already wraps every authed route in <AdminShell>;
 * this page just sets the request locale for next-intl/server and hands the course id
 * over to the client component (which owns TanStack Query + nuqs tab state + tabs).
 *
 * `force-dynamic`: the client uses `nuqs` (which calls `useSearchParams()` internally)
 * and TanStack Query against `/api/auth/me` — both require runtime access to the
 * request. Mirrors /[locale]/groups/[id]/page.tsx (Phase 4 Plan 03).
 */
export const dynamic = 'force-dynamic';

export default async function CourseDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const courseId = Number(id);
    return <CourseDetailClient courseId={courseId} />;
}
