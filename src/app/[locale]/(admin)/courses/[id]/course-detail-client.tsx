'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { usePermission } from '@/lib/access/use-permission';
import { getCourse } from '@/lib/courses/api';
import { statusBadgeVariant } from '@/lib/courses/format';
import type { CourseDetail, CourseRow } from '@/lib/courses/types';
import { TranslationCompletenessBadge } from '../components/translation-completeness-badge';
import { DeleteCourseDialog } from '../components/delete-course-dialog';
import { TeacherChangeDialog } from './components/teacher-change-dialog';
import { OverviewTab } from './tabs/overview-tab';
import { ContentTab } from './tabs/content-tab';
import { ScheduleTab } from './tabs/schedule-tab';
import { PreviewTab } from './tabs/preview-tab';

const TABS = ['overview', 'content', 'schedule', 'preview'] as const;
type TabKey = (typeof TABS)[number];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * CRS-01 + CRS-07 — tabbed course detail client (Plan 03).
 *
 * Tabs (CONTEXT D-05): Overview / Content / Schedule / Preview — URL state via nuqs
 * `?tab=` query param. Reload-survivable + shareable. Mirrors Phase 4 Plan 03
 * group-detail-client.tsx structure with one extra tab.
 *
 * Detail query keyed by `['admin.courses.detail', courseId]` so child components
 * (OverviewTab, EditCourseForm, TranslationForm) can `setQueryData` after a
 * successful mutation and the UI updates without a roundtrip.
 *
 * 403 handling: per Plan 03 admin-api detail service, a teacher hitting another
 * teacher's course (or a curator on any course) receives 403, NOT 404. The
 * `getCourse` wrapper throws an Error with status text; we surface the dedicated
 * forbidden_scope copy when the message carries '403'.
 *
 * Lazy-mount strategy:
 *   - Overview is always mounted (cheap field grid + form).
 *   - Content / Schedule / Preview are gated by `safeTab === '<tab>' ? <Tab /> : null`
 *     so Plans 05/06/07 are free to mount heavy queries inside their tabs without
 *     polluting the first-paint budget for Overview-only navigators.
 *
 * Page header: course title (RU translation, fallback to slug) + status Badge +
 * <TranslationCompletenessBadge> (reused from Plan 02) + Delete button (admin/teacher
 * own — opens <DeleteCourseDialog>) + "Change teacher" button (admin only — opens
 * <TeacherChangeDialog>, Plan 07 / CRS-06).
 *
 * Plan 07 wire-up: TeacherChangeDialog is admin-only at the client (button hidden
 * for non-admin) AND admin-only at the server (@Roles('admin') on PATCH
 * /admin-api/v1/admin/courses/:id/teacher). The dialog strips the response's
 * `previous_teacher_id` audit-meta field before caching as CourseDetail.
 */
export function CourseDetailClient({ courseId }: { courseId: number }) {
    const t = useTranslations('admin.courses');
    const locale = useLocale();
    const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('overview'));

    // Role detection — drives admin-only buttons.
    const me = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const role = me.data?.data?.role_name ?? 'curator';

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId),
        retry: false,
    });

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [teacherOpen, setTeacherOpen] = useState(false);

    if (isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (error || !data) {
        const msg = error instanceof Error ? error.message : '';
        const isForbidden = msg.includes('403');
        const isNotFound = msg.includes('404');
        return (
            <div className='p-6'>
                <Alert variant='destructive'>
                    <AlertTitle>
                        {isForbidden
                            ? t('forbidden_scope')
                            : isNotFound
                              ? t('not_found')
                              : t('generic_error')}
                    </AlertTitle>
                    {!isForbidden && !isNotFound ? <AlertDescription>{msg}</AlertDescription> : null}
                </Alert>
            </div>
        );
    }

    const safeTab: TabKey = (TABS as readonly string[]).includes(tab) ? (tab as TabKey) : 'overview';

    // Header title: prefer RU translation, fallback to slug.
    const ruTitle = data.translations.find((tr) => tr.locale === 'kz')?.title;
    const headerTitle = ruTitle && ruTitle.trim().length > 0 ? ruTitle : data.slug;

    const canEdit = usePermission('courses.edit');
    const canDelete = usePermission('courses.delete');

    // DeleteCourseDialog accepts a CourseRow. Synthesize one from CourseDetail —
    // the dialog only reads id, slug, and chapter_count.
    const synthesizedRow: CourseRow = {
        id: data.id,
        slug: data.slug,
        title_kz: data.translations.find((tr) => tr.locale === 'kz')?.title ?? null,
        status: data.status,
        teacher: data.teacher
            ? { id: data.teacher.id, full_name: data.teacher.full_name }
            : null,
        category: data.category ? { id: data.category.id, slug: data.category.slug } : null,
        image_cover: data.image_cover,
        translation_completeness: data.translation_completeness,
        missing_locales: data.missing_locales,
        chapter_count: data.counts.chapter_count,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };

    const statusLabel =
        data.status === 'active'
            ? t('status_active')
            : data.status === 'pending'
              ? t('status_pending')
              : data.status === 'is_draft'
                ? t('status_is_draft')
                : t('status_inactive');

    return (
        <TooltipProvider>
            <PageShell
                header={
                    <PageHeader
                        title={headerTitle}
                        subtitle={`${t('col_slug')}: ${data.slug}`}
                        breadcrumbs={[
                            { label: t('list_title'), href: `/${locale}/courses` },
                            { label: headerTitle },
                        ]}
                        badge={
                            <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant={statusBadgeVariant(data.status)}>{statusLabel}</Badge>
                                <TranslationCompletenessBadge
                                    completeness={data.translation_completeness}
                                    missingLocales={data.missing_locales}
                                />
                            </div>
                        }
                        actions={
                            <>
                                {canEdit ? (
                                    <Button variant='outline' onClick={() => setTeacherOpen(true)}>
                                        {t('change_teacher')}
                                    </Button>
                                ) : null}
                                {canDelete ? (
                                    <Button variant='destructive' onClick={() => setDeleteOpen(true)}>
                                        {t('delete')}
                                    </Button>
                                ) : null}
                            </>
                        }
                    />
                }
                contentClassName='space-y-4'
            >
                <Tabs value={safeTab} onValueChange={(v) => setTab(v)}>
                    <TabsList variant='line' className='w-full justify-start'>
                        <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                        <TabsTrigger value='content'>{t('content_tab')}</TabsTrigger>
                        <TabsTrigger value='schedule'>{t('schedule_tab')}</TabsTrigger>
                        <TabsTrigger value='preview'>{t('preview_tab')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value='overview'>
                        <OverviewTab course={data} role={role} />
                    </TabsContent>
                    <TabsContent value='content'>
                        {safeTab === 'content' ? <ContentTab courseId={courseId} /> : null}
                    </TabsContent>
                    <TabsContent value='schedule'>
                        {safeTab === 'schedule' ? <ScheduleTab courseId={courseId} /> : null}
                    </TabsContent>
                    <TabsContent value='preview'>
                        {safeTab === 'preview' ? <PreviewTab courseId={courseId} /> : null}
                    </TabsContent>
                </Tabs>

                {canDelete ? (
                    <DeleteCourseDialog
                        open={deleteOpen}
                        onOpenChange={setDeleteOpen}
                        course={synthesizedRow}
                    />
                ) : null}

                {canEdit ? (
                    <TeacherChangeDialog open={teacherOpen} onOpenChange={setTeacherOpen} course={data} />
                ) : null}
            </PageShell>
        </TooltipProvider>
    );
}
