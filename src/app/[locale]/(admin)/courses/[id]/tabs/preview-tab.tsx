'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getCoursePreview } from '@/lib/courses/api';
import type { Locale } from '@/lib/courses/types';
import { PreviewGroupPicker } from '../components/preview-group-picker';
import { PreviewRenderer } from '../components/preview-renderer';

/**
 * Preview tab — Plan 07 (CRS-09).
 *
 * Replaces Plan 03's placeholder. Orchestrates a `?preview_group=<id>` URL state
 * (so the selection survives reloads + share-links) and renders the read-only
 * "preview as student" mirror via PreviewRenderer.
 *
 * URL state vs local state: `?preview_group` mirrors the Plan 06 schedule tab's
 * `?schedule_group` — admins frequently share links to "course X as group Y student"
 * with curators / teachers. Reload-survivable.
 *
 * NOT impersonation (T-05-79): the request to GET /admin-api/v1/admin/courses/:id/preview
 * goes through the BFF proxy with the admin's Bearer cookie attached server-side. The
 * admin's session never changes; the preview is a server-side computation of "what would
 * a student see" rendered into the admin UI.
 *
 * Re-sanitize on render: PreviewRenderer applies sanitizeTiptapHtml to file
 * description bodies before injecting into the DOM. Defense in depth — Plan 05's
 * mutation path already sanitizes on save; this is the final boundary for any row
 * that predates the sanitize-on-save wire-up.
 */
export function PreviewTab({ courseId }: { courseId: number }) {
    const params = useParams<{ locale: Locale }>();
    const locale: Locale = params?.locale === 'kz' ? 'kz' : 'kz';
    const [groupId, setGroupId] = useQueryState('preview_group', parseAsString);
    const t = useTranslations('admin.courses');

    const groupIdNum =
        groupId && /^\d+$/.test(groupId) ? Number(groupId) : undefined;

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.courses.preview', courseId, groupIdNum ?? null],
        queryFn: () => getCoursePreview(courseId, groupIdNum),
        retry: false,
    });

    return (
        <div className='space-y-4 pt-4'>
            <div className='flex items-end justify-between gap-4'>
                <div className='space-y-1'>
                    <h2 className='text-lg font-semibold'>{t('preview_tab')}</h2>
                    <p className='text-muted-foreground text-sm'>
                        {t('preview_pick_group_help')}
                    </p>
                </div>
                <PreviewGroupPicker value={groupId} onChange={(v) => setGroupId(v)} />
            </div>

            {isLoading ? (
                <div className='space-y-3'>
                    <Skeleton className='h-10 w-1/3' />
                    <Skeleton className='h-72 w-full' />
                </div>
            ) : error ? (
                <Alert variant='destructive'>
                    <AlertTitle>{t('preview_failed')}</AlertTitle>
                    <AlertDescription>
                        {error instanceof Error ? error.message : t('generic_error')}
                    </AlertDescription>
                </Alert>
            ) : data ? (
                <PreviewRenderer preview={data} locale={locale} />
            ) : null}
        </div>
    );
}
