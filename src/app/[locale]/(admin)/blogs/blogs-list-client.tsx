'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BulkActionToolbar } from '@/components/users/bulk-action-toolbar';
import { EmptyState } from '@/components/users/empty-state';
import { Button } from '@/components/ui/button';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listBlogs } from '@/lib/blogs/api';
import type { BlogRow, BlogStatus } from '@/lib/blogs/types';
import { BulkStatusSheet } from './components/bulk-status-sheet';
import { DeleteBlogDialog } from './components/delete-blog-dialog';
import { UpsertBlogDialog } from './components/upsert-blog-dialog';
import { BlogsFilters } from './blogs-filters';
import { BlogsTable } from './blogs-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

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
    const locale = useLocale() as 'ru' | 'kz';
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
        enabled: !me.isLoading && isAdmin,
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
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('list_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('list_subtitle')}</p>
                </div>
                <div className='flex items-center gap-2'>
                    <Button asChild variant='outline'>
                        <Link href={`/${locale}/blogs/categories`}>{t('categories_title')}</Link>
                    </Button>
                    {isAdmin ? (
                        <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
                    ) : null}
                </div>
            </header>

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

            <BulkActionToolbar
                selectedCount={selection.selectedCount}
                onClear={() => selection.clear()}
            >
                <Button
                    size='sm'
                    onClick={() =>
                        setBulkSheet({ open: true, target: 'publish' })
                    }
                >
                    {t('publish_action_short')}
                </Button>
                <Button
                    size='sm'
                    variant='outline'
                    onClick={() =>
                        setBulkSheet({ open: true, target: 'pending' })
                    }
                >
                    {t('unpublish_action_short')}
                </Button>
            </BulkActionToolbar>

            <div className='flex-1 overflow-auto'>
                {error ? (
                    <EmptyState title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState title={emptyTitle} />
                ) : (
                    <BlogsTable
                        rows={rows}
                        loading={isLoading}
                        selection={selection}
                        onEdit={onEdit}
                        onDelete={(r) => setDeleteRow(r)}
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

            <UpsertBlogDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                blog={null}
            />
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
        </div>
    );
}
