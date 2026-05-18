'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BookOpen } from 'lucide-react';
import { BulkActionToolbar } from '@/components/users/bulk-action-toolbar';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { usePermission } from '@/lib/access/use-permission';
import { useMe } from '@/lib/access/use-me';
import { listBlogs } from '@/lib/blogs/api';
import type { BlogRow, BlogStatus } from '@/lib/blogs/types';
import { BulkStatusSheet } from './components/bulk-status-sheet';
import { DeleteBlogDialog } from './components/delete-blog-dialog';
import { UpsertBlogDialog } from './components/upsert-blog-dialog';
import { BlogsFilters } from './blogs-filters';
import { BlogsTable } from './blogs-table';

/**
 * BLG-01 — TanStack-Query-driven blogs list page with nuqs URL state.
 *
 * URL state: page, page_size, q, status, category_id, author_id, sort, order. Filter
 * changes reset page=1.
 *
 * Bulk selection (D-02): page-scoped useBulkSelection<number>(). BulkActionToolbar
 * mounted above the table; clicking publish/unpublish opens BulkStatusSheet.
 *
 * Edit decision (Plan 04 lock): "Edit" in the row dropdown navigates to the detail
 * page (`/[locale]/blogs/[id]`) rather than opening UpsertBlogDialog. The detail
 * page hosts the Tiptap editor for content; the dialog is for create-only.
 */
export function BlogsListClient() {
    const t = useTranslations('admin.blogs');
    const locale = useLocale();
    const router = useRouter();

    const [{ page, page_size, status, category_id, q, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        category_id: parseAsInteger,
        q: parseAsString,
        sort: parseAsString.withDefault('created_at'),
        order: parseAsString.withDefault('desc'),
    });

    const me = useMe();
    const canView = usePermission('blogs.view');
    const canCreate = usePermission('blogs.create');
    const canEdit = usePermission('blogs.edit');
    const canDelete = usePermission('blogs.delete');
    const canPublish = usePermission('blogs.publish');

    const queryKey = useMemo(
        () => ['admin.blogs.list', { page, page_size, status, category_id, q, sort, order }] as const,
        [page, page_size, status, category_id, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listBlogs({
                page,
                page_size,
                status: (status as BlogStatus | null) ?? undefined,
                category_id: category_id ?? undefined,
                q: q ?? undefined,
                sort: (sort as 'created_at' | 'updated_at' | 'visit_count') ?? undefined,
                order: (order as 'asc' | 'desc') ?? undefined,
            }),
        placeholderData: (prev) => prev,
        enabled: !me.isLoading && canView,
    });

    const rows: BlogRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(status || category_id || (q && q.trim().length > 0));

    const selection = useBulkSelection<number>();

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<BlogRow | null>(null);
    const [bulkSheet, setBulkSheet] = useState<{ open: boolean; target: BlogStatus }>({
        open: false,
        target: 'publish',
    });

    const onEdit = (row: BlogRow) => {
        // Navigate to detail page (Tiptap editor lives there).
        router.push(`/${locale}/blogs/${row.id}`);
    };

    const selectedIds = useMemo(() => Array.from(selection.selected), [selection.selected]);

    const emptyTitle = anyFilterActive ? t('empty_filtered') : t('empty_state');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <>
                            <Button asChild variant='outline'>
                                <Link href={`/${locale}/blogs/categories`}>{t('categories_title')}</Link>
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
                <BlogsFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as BlogStatus | null) ?? undefined,
                        category_id: category_id ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            category_id: next.category_id ?? null,
                        })
                    }
                />
            </Card>

            {canPublish ? (
                <BulkActionToolbar selectedCount={selection.selectedCount} onClear={() => selection.clear()}>
                    <Button size='sm' onClick={() => setBulkSheet({ open: true, target: 'publish' })}>
                        {t('publish_action_short')}
                    </Button>
                    <Button size='sm' variant='outline' onClick={() => setBulkSheet({ open: true, target: 'pending' })}>
                        {t('unpublish_action_short')}
                    </Button>
                </BulkActionToolbar>
            ) : null}

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={BookOpen} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={BookOpen} title={emptyTitle} />
                ) : (
                    <BlogsTable
                        rows={rows}
                        loading={isLoading}
                        selection={selection}
                        onEdit={onEdit}
                        onDelete={(r) => setDeleteRow(r)}
                        canEdit={canEdit}
                        canDelete={canDelete}
                    />
                )}
            </Card>

            <UpsertBlogDialog open={createOpen} onOpenChange={setCreateOpen} blog={null} />
            <DeleteBlogDialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
                blog={deleteRow}
            />
            <BulkStatusSheet
                open={bulkSheet.open}
                onOpenChange={(o) => setBulkSheet((s) => ({ ...s, open: o }))}
                selectedIds={selectedIds}
                targetStatus={bulkSheet.target}
                onCommitted={() => selection.clear()}
            />
        </PageShell>
    );
}
