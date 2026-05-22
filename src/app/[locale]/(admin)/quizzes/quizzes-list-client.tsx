'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Award, ClipboardList, FolderTree } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { usePermission } from '@/lib/access/use-permission';
import { listQuizzes } from '@/lib/quizzes/api';
import type {
    QuestionCountBucket,
    QuizRow,
    QuizSortField,
    QuizStatus,
    SortOrder,
} from '@/lib/quizzes/types';
import { AddToBadgeDialog } from './components/add-to-badge-dialog';
import { CreateQuizDialog } from './components/create-quiz-dialog';
import { DeleteQuizDialog } from './components/delete-quiz-dialog';
import { QuizzesFilters } from './quizzes-filters';
import { QuizzesTable } from './quizzes-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * QZ-01 — TanStack-Query-driven quizzes list page with nuqs URL state.
 *
 * URL state (D-02):
 *   page, page_size, q, status, category_id, badge_id, question_count_bucket,
 *   sort, order. Filter changes reset page=1.
 *
 * Empty state is role-aware:
 *   - admin/teacher + no filters -> empty_admin
 *   - admin + filters active     -> empty_admin_filtered (re-uses key from courses pattern)
 *   - curator                    -> empty_admin (defensive — AdminNav already hides)
 *
 * Mutation buttons:
 *   - Create: visible to admin + teacher (D-21)
 *   - Delete: visible to admin only (D-21 safe default)
 *   - Duplicate: visible to admin + teacher
 */
export function QuizzesListClient() {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();

    const [
        { page, page_size, status, category_id, badge_id, question_count_bucket, q, sort, order },
        setQ,
    ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        category_id: parseAsInteger,
        badge_id: parseAsInteger,
        question_count_bucket: parseAsString,
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
    const canCreate = usePermission('quizzes.create');
    const canEdit = usePermission('quizzes.edit');
    const canDelete = usePermission('quizzes.delete');
    const canMutate = canEdit || canDelete;

    const queryKey = useMemo(
        () =>
            [
                'admin.quizzes.list',
                {
                    page,
                    page_size,
                    status,
                    category_id,
                    badge_id,
                    question_count_bucket,
                    q,
                    sort,
                    order,
                },
            ] as const,
        [page, page_size, status, category_id, badge_id, question_count_bucket, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listQuizzes({
                page,
                page_size,
                status: (status as QuizStatus | null) ?? undefined,
                category_id: category_id ?? undefined,
                badge_id: badge_id ?? undefined,
                question_count_bucket: (question_count_bucket as QuestionCountBucket | null) ?? undefined,
                q: q ?? undefined,
                sort: sort as QuizSortField,
                order: order as SortOrder,
            }),
        placeholderData: (prev) => prev,
        enabled: !me.isLoading,
    });

    const rows: QuizRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(
        status ||
            category_id ||
            badge_id ||
            question_count_bucket ||
            (q && q.trim().length > 0),
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<QuizRow | null>(null);
    const [addToBadgeRow, setAddToBadgeRow] = useState<QuizRow | null>(null);

    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty_admin');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <>
                            <Button asChild variant='outline' size='sm'>
                                <Link href={`/${locale}/quizzes/categories`}>
                                    <FolderTree className='mr-2 h-4 w-4' />
                                    {t('categories_page_title')}
                                </Link>
                            </Button>
                            <Button asChild variant='outline' size='sm'>
                                <Link href={`/${locale}/quizzes/badges`}>
                                    <Award className='mr-2 h-4 w-4' />
                                    {t('badges_page_title')}
                                </Link>
                            </Button>
                            {canCreate ? (
                                <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
                            ) : null}
                        </>
                    }
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
                <QuizzesFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as QuizStatus | null) ?? undefined,
                        category_id: category_id ?? undefined,
                        badge_id: badge_id ?? undefined,
                        question_count_bucket:
                            (question_count_bucket as QuestionCountBucket | null) ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            category_id: next.category_id ?? null,
                            badge_id: next.badge_id ?? null,
                            question_count_bucket: next.question_count_bucket ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={ClipboardList} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={ClipboardList} title={emptyTitle} />
                ) : (
                    <QuizzesTable
                        rows={rows}
                        loading={isLoading}
                        canMutate={canMutate}
                        canDelete={canDelete}
                        onDelete={(row) => setDeleteRow(row)}
                        onAddToBadge={canEdit ? (row) => setAddToBadgeRow(row) : undefined}
                    />
                )}
            </Card>

            {canCreate ? <CreateQuizDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}
            {canDelete ? (
                <DeleteQuizDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    quiz={deleteRow}
                />
            ) : null}
            {canEdit ? (
                <AddToBadgeDialog
                    open={addToBadgeRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setAddToBadgeRow(null);
                    }}
                    quiz={addToBadgeRow}
                />
            ) : null}
        </PageShell>
    );
}
