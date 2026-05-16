'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listCourses } from '@/lib/courses/api';
import type {
    CourseRow,
    CourseSortField,
    CourseStatus,
    SortOrder,
    TranslationCompleteness,
} from '@/lib/courses/types';
import { CreateCourseDialog } from './components/create-course-dialog';
import { DeleteCourseDialog } from './components/delete-course-dialog';
import { CoursesFilters } from './courses-filters';
import { CoursesTable } from './courses-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * CRS-01 — TanStack-Query-driven courses list page with nuqs URL state.
 *
 * URL state (CONTEXT D-02):
 *   page, page_size, q, status, teacher_id, category_id, translation_completeness,
 *   sort, order. Filter changes reset page=1; sort changes do not.
 *
 * Empty state (CONTEXT D-01) is role-aware:
 *   - admin + filters active -> empty_admin_filtered
 *   - admin + no filters     -> empty_admin
 *   - teacher                -> empty_teacher_no_courses
 *   - curator                -> empty_curator (defensive — AdminNav already hides Courses for curator)
 *
 * Create button visible to admin and teacher (per CRS-07 — teachers create their
 * own courses). Delete dropdown visible to admin AND teachers on courses they own
 * (server-side 403 enforces the actual authorization; we surface the action liberally).
 */
export function CoursesListClient() {
    const t = useTranslations('admin.courses');

    const [
        { page, page_size, status, teacher_id, category_id, translation_completeness, q, sort, order },
        setQ,
    ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        teacher_id: parseAsInteger,
        category_id: parseAsInteger,
        translation_completeness: parseAsString,
        q: parseAsString,
        sort: parseAsString.withDefault('created_at'),
        order: parseAsString.withDefault('desc'),
    });

    const me = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const role = me.data?.data?.role_name;
    const isAdmin = role === 'admin';
    const isTeacher = role === 'teacher';
    const isCurator = role === 'curator';
    const canMutate = isAdmin || isTeacher;

    const queryKey = useMemo(
        () =>
            [
                'admin.courses.list',
                {
                    page,
                    page_size,
                    status,
                    teacher_id,
                    category_id,
                    translation_completeness,
                    q,
                    sort,
                    order,
                },
            ] as const,
        [page, page_size, status, teacher_id, category_id, translation_completeness, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listCourses({
                page,
                page_size,
                status: (status as CourseStatus | null) ?? undefined,
                teacher_id: teacher_id ?? undefined,
                category_id: category_id ?? undefined,
                translation_completeness:
                    (translation_completeness as TranslationCompleteness | null) ?? undefined,
                q: q ?? undefined,
                sort: sort as CourseSortField,
                order: order as SortOrder,
            }),
        placeholderData: (prev) => prev,
        // Only run once we know the role (so the empty-state copy can branch correctly on first paint).
        enabled: !me.isLoading,
    });

    const rows: CourseRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(
        status ||
            teacher_id ||
            category_id ||
            translation_completeness ||
            (q && q.trim().length > 0),
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<CourseRow | null>(null);

    const emptyTitle = isAdmin
        ? anyFilterActive
            ? t('empty_admin_filtered')
            : t('empty_admin')
        : isTeacher
        ? t('empty_teacher_no_courses')
        : t('empty_admin'); /* curator fallback — never displayed in practice */

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={canMutate ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
                />
            }
            footer={
                rows.length > 0 || page > 1 ? (
                    <DataTablePagination
                        page={page}
                        pageSize={page_size}
                        total={total}
                        rowCount={rows.length}
                        isFetching={isFetching}
                        onPageChange={(p) => setQ({ page: p })}
                        onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                    />
                ) : null
            }
            contentClassName='space-y-4'
        >
            <Card className='p-4'>
                <CoursesFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as CourseStatus | null) ?? undefined,
                        teacher_id: teacher_id ?? undefined,
                        category_id: category_id ?? undefined,
                        translation_completeness:
                            (translation_completeness as TranslationCompleteness | null) ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            teacher_id: next.teacher_id ?? null,
                            category_id: next.category_id ?? null,
                            translation_completeness: next.translation_completeness ?? null,
                        })
                    }
                    showTeacherFilter={isAdmin}
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={GraduationCap} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={GraduationCap} title={emptyTitle} />
                ) : (
                    <CoursesTable
                        rows={rows}
                        loading={isLoading}
                        canMutate={canMutate}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </Card>

            {canMutate ? (
                <>
                    <CreateCourseDialog
                        open={createOpen}
                        onOpenChange={setCreateOpen}
                        actorRole={(role as 'admin' | 'teacher') ?? 'admin'}
                        actorId={me.data?.data?.user_id ?? null}
                    />
                    <DeleteCourseDialog
                        open={deleteRow !== null}
                        onOpenChange={(o) => {
                            if (!o) setDeleteRow(null);
                        }}
                        course={deleteRow}
                    />
                </>
            ) : null}
            <span hidden aria-hidden data-curator={isCurator ? '1' : '0'} />
        </PageShell>
    );
}
