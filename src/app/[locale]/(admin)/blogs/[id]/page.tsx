import { setRequestLocale } from 'next-intl/server';
import { BlogDetailClient } from './blog-detail-client';

/**
 * BLG-01 / D-10 — server-component shell for the blog detail/edit page.
 *
 * `force-dynamic`: TanStack Query hits the BFF proxy + `/api/auth/me`.
 */
export const dynamic = 'force-dynamic';

export default async function BlogDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const blogId = Number(id);
    if (!Number.isFinite(blogId) || blogId <= 0) {
        return <div className='p-6 text-sm text-destructive'>Invalid blog id.</div>;
    }
    return <BlogDetailClient blogId={blogId} />;
}
