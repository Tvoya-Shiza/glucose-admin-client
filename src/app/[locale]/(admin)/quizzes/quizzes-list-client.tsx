'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { EmptyState } from '@/components/users/empty-state';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listQuizzes } from '@/lib/quizzes/api';
import type {
    QuestionCountBucket,
    QuizRow,
    QuizSortField,
    QuizStatus,
    SortOrder,
} from '@/lib/quizzes/types';
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
    const role = me.data?.data?.role_name;
    const isAdmin = role === 'admin';
    const isTeacher = role === 'teacher';
    const canMutate = isAdmin || isTeacher;
    const canDelete = isAdmin;

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

    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty_admin');

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('list_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('list_subtitle')}</p>
                </div>
                {canMutate ? (
                    <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
                ) : null}
            </header>

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

            <div className='flex-1 overflow-auto'>
                {error ? (
                    <EmptyState title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState title={emptyTitle} />
                ) : (
                    <QuizzesTable
                        rows={rows}
                        loading={isLoading}
                        canMutate={canMutate}
                        canDelete={canDelete}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </div>

            <footer className='flex items-center justify-between border-t p-4 text-sm'>
                <span className='text-muted-foreground'>
                    {isFetching ? t('loading') : `${total}`}
                </span>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => setQ({ page: page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='tabular-nums'>{page}</span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={rows.length < page_size}
                        onClick={() => setQ({ page: page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            </footer>

            {canMutate ? (
                <CreateQuizDialog open={createOpen} onOpenChange={setCreateOpen} />
            ) : null}
            {canDelete ? (
                <DeleteQuizDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    quiz={deleteRow}
                />
            ) : null}
        </div>
    );
}
