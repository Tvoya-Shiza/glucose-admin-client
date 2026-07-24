'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BookOpenText } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { BookPublishBlockedError, listBooks, publishBook } from '@/lib/ebooks/api';
import type { BookRow, BookStatus } from '@/lib/ebooks/types';
import { CreateBookDialog } from './components/create-book-dialog';
import { DeleteBookDialog } from './components/delete-book-dialog';
import { EbooksFilters } from './ebooks-filters';
import { EbooksTable } from './ebooks-table';

/**
 * Phase 39/40 — «Электронды кітаптар» list page (ТЗ §6.0).
 *
 * URL state via nuqs: page/page_size/subject_id/publisher_id/grade (integers),
 * q/status (strings). Filter changes reset page=1. TanStack Query keyed on the
 * full filter object with keepPrevious (placeholderData) so rows persist while a
 * filter/page change refetches.
 *
 * Mutations:
 *   - Create (ebooks.create): opens the create dialog → routes to detail.
 *   - Publish/Hide (ebooks.publish): sets Book.status; a 409 publish_blocked
 *     (zero pages) is surfaced with a reason toast.
 *   - Delete (ebooks.delete): soft-delete dialog.
 *
 * Publishers (the reference table books link to) live on the /ebooks/publishers
 * sub-route, reachable from this header — they share the ebooks.* permissions.
 */
export function EbooksListClient() {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();
    const qc = useQueryClient();

    const [{ page, page_size, status, subject_id, publisher_id, grade, q }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        subject_id: parseAsInteger,
        publisher_id: parseAsInteger,
        grade: parseAsInteger,
        q: parseAsString,
    });

    const canCreate = usePermission('ebooks.create');
    const canEdit = usePermission('ebooks.edit');
    const canDelete = usePermission('ebooks.delete');
    const canPublish = usePermission('ebooks.publish');
    const canMutate = canEdit || canDelete || canPublish;

    const queryKey = useMemo(
        () => ['admin.ebooks.list', { page, page_size, status, subject_id, publisher_id, grade, q }] as const,
        [page, page_size, status, subject_id, publisher_id, grade, q]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listBooks({
                page,
                page_size,
                status: (status as BookStatus | null) ?? undefined,
                subject_id: subject_id ?? undefined,
                publisher_id: publisher_id ?? undefined,
                grade: grade ?? undefined,
                q: q ?? undefined,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: BookRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(status || subject_id || publisher_id || grade || (q && q.trim().length > 0));
    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty');

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<BookRow | null>(null);

    const publishMutation = useMutation({
        mutationFn: ({ row, next }: { row: BookRow; next: BookStatus }) => publishBook(row.id, { status: next }),
        onSuccess: (result) => {
            toast.success(result.status === 'active' ? t('publish_success') : t('hide_success'));
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.ebooks.detail', result.id] });
        },
        onError: (err: unknown) => {
            if (err instanceof BookPublishBlockedError) {
                toast.error(t('publish_blocked', { pages: err.page_count }));
                return;
            }
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <>
                            <Button variant='outline' asChild>
                                <Link href={`/${locale}/ebooks/publishers`}>{t('publishers_manage')}</Link>
                            </Button>
                            {canCreate ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
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
                <EbooksFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as BookStatus | null) ?? undefined,
                        subject_id: subject_id ?? undefined,
                        publisher_id: publisher_id ?? undefined,
                        grade: grade ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            subject_id: next.subject_id ?? null,
                            publisher_id: next.publisher_id ?? null,
                            grade: next.grade ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={BookOpenText} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={BookOpenText} title={emptyTitle} />
                ) : (
                    <EbooksTable
                        rows={rows}
                        loading={isLoading}
                        canMutate={canMutate}
                        canDelete={canDelete}
                        canPublish={canPublish}
                        onDelete={(row) => setDeleteRow(row)}
                        onPublish={(row, next) => publishMutation.mutate({ row, next })}
                    />
                )}
            </Card>

            {canCreate ? <CreateBookDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}
            {canDelete ? (
                <DeleteBookDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    book={deleteRow}
                />
            ) : null}
        </PageShell>
    );
}
