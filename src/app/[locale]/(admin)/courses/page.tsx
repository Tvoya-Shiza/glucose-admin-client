import { setRequestLocale } from 'next-intl/server';
import { CoursesListClient } from './courses-list-client';

/**
 * CRS-01 — server-component shell that mounts CoursesListClient.
 *
 * `force-dynamic`: nuqs uses `useSearchParams()` and TanStack Query hits
 * `/api/auth/me` — both require runtime access to the request. Static prerender
 * bails out without an explicit Suspense boundary; opting the route into dynamic
 * rendering is the documented Next.js fix and matches the Phase 4 groups page.
 */
export const dynamic = 'force-dynamic';

export default async function CoursesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <CoursesListClient />;
}
