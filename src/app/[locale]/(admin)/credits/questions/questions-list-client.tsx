'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { FileQuestion, FolderTree } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsSuper, usePermission } from '@/lib/access/use-permission';
import { deleteCreditQuestion, updateCreditQuestion } from '@/lib/credits/api';
import { listCreditQuestions } from '@/lib/credits/api';
import type { CreditBankStatus, CreditDifficulty, CreditQuestionRow } from '@/lib/credits/types';
import { UpsertQuestionDialog } from './components/upsert-question-dialog';
import { QuestionsFilters } from './questions-filters';
import { QuestionsTable } from './questions-table';

/**
 * Phase 34 — credit question bank. nuqs URL state, TanStack Query list,
 * upsert/archive/restore gated by `credits.questions_manage`; DELETE is
 * admin-only on the server, so the action is gated by is_super here.
 */
export function QuestionsListClient() {
    const t = useTranslations('admin.credit_questions');
    const locale = useLocale();
    const qc = useQueryClient();

    const [{ page, page_size, search, topic_id, include_descendants, difficulty, status }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        search: parseAsString,
        topic_id: parseAsString,
        include_descendants: parseAsBoolean,
        difficulty: parseAsString,
        status: parseAsString,
    });

    const canManage = usePermission('credits.questions_manage');
    const isSuper = useIsSuper();

    const queryKey = useMemo(
        () => ['admin.credit-questions.list', { page, page_size, search, topic_id, include_descendants, difficulty, status }] as const,
        [page, page_size, search, topic_id, include_descendants, difficulty, status]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listCreditQuestions({
                page,
                page_size,
                search: search ?? undefined,
                topic_id: topic_id ?? undefined,
                include_descendants: include_descendants ?? undefined,
                difficulty: (difficulty as CreditDifficulty | null) ?? undefined,
                status: (status as CreditBankStatus | null) ?? undefined,
            }),
        staleTime: 0,
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(topic_id || difficulty || status || (search && search.trim().length > 0));

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editRow, setEditRow] = useState<CreditQuestionRow | null>(null);
    const [deleteRow, setDeleteRow] = useState<CreditQuestionRow | null>(null);

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['admin.credit-questions.list'], exact: false });
        qc.invalidateQueries({ queryKey: ['admin.credits.topics'], exact: false });
    };

    const archiveMutation = useMutation({
        mutationFn: (row: CreditQuestionRow) => updateCreditQuestion(row.id, { status: row.status === 'active' ? 'archived' : 'active' }),
        onSuccess: (_res, row) => {
            toast.success(row.status === 'active' ? t('archived_success') : t('restored_success'));
            invalidate();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (row: CreditQuestionRow) => deleteCreditQuestion(row.id),
        onSuccess: () => {
            toast.success(t('deleted_success'));
            setDeleteRow(null);
            invalidate();
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    breadcrumbs={[{ label: t('credits_breadcrumb'), href: `/${locale}/credits` }, { label: t('list_title') }]}
                    actions={
                        <>
                            <Button asChild variant='outline' size='sm'>
                                <Link href={`/${locale}/credits/questions/topics`}>
                                    <FolderTree className='mr-2 h-4 w-4' />
                                    {t('topics_link')}
                                </Link>
                            </Button>
                            {canManage ? (
                                <Button
                                    onClick={() => {
                                        setEditRow(null);
                                        setUpsertOpen(true);
                                    }}
                                >
                                    {t('create')}
                                </Button>
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
            <Card className='p-0'>
                <QuestionsFilters
                    value={{
                        search: search ?? undefined,
                        topic_id: topic_id ?? undefined,
                        include_descendants: include_descendants ?? undefined,
                        difficulty: (difficulty as CreditDifficulty | null) ?? undefined,
                        status: (status as CreditBankStatus | null) ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            search: next.search ?? null,
                            topic_id: next.topic_id ?? null,
                            include_descendants: next.include_descendants ?? null,
                            difficulty: next.difficulty ?? null,
                            status: next.status ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={FileQuestion} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={FileQuestion} title={emptyTitle} />
                ) : (
                    <QuestionsTable
                        rows={rows}
                        loading={isLoading}
                        canManage={canManage}
                        canDelete={isSuper}
                        onEdit={(row) => {
                            setEditRow(row);
                            setUpsertOpen(true);
                        }}
                        onToggleArchive={(row) => archiveMutation.mutate(row)}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </Card>

            {canManage ? (
                <UpsertQuestionDialog
                    open={upsertOpen}
                    onOpenChange={(o) => {
                        setUpsertOpen(o);
                        if (!o) setEditRow(null);
                    }}
                    initial={editRow}
                    defaultTopicId={topic_id}
                />
            ) : null}

            <Dialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                        <DialogDescription>{t('delete_dialog_description')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDeleteRow(null)} disabled={deleteMutation.isPending}>
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={deleteRow == null || deleteMutation.isPending}
                            onClick={() => deleteRow && deleteMutation.mutate(deleteRow)}
                        >
                            {deleteMutation.isPending ? t('loading') : t('delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
