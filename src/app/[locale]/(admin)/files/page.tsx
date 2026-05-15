import { setRequestLocale } from 'next-intl/server';
import { FilesListClient } from './files-list-client';

/**
 * File library page. Lists every successful upload tracked in `upload_assets`
 * (Phase 5+ Upload registry). Staff-only: GET /admin-api/v1/admin/uploads is
 * gated on admin/teacher/curator; DELETE is admin/teacher.
 *
 * `force-dynamic` because nuqs needs runtime access to the request and
 * TanStack Query queries `/api/auth/me`.
 */
export const dynamic = 'force-dynamic';

export default async function FilesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <FilesListClient />;
}
