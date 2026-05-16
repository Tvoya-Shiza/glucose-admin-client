'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Image as ImageIcon } from 'lucide-react';
import { BulkActionToolbar } from '@/components/users/bulk-action-toolbar';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { getBanner, listBanners } from '@/lib/banners/api';
import type { BannerDetail, BannerRow, BannerStatus } from '@/lib/banners/types';
import { BulkStatusSheet } from './components/bulk-status-sheet';
import { DeleteBannerDialog } from './components/delete-banner-dialog';
import { UpsertBannerDialog } from './components/upsert-banner-dialog';
import { BannersFilters } from './banners-filters';
import { BannersTable } from './banners-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * BAN-01 — TanStack-Query-driven banners list page with nuqs URL state.
 *
 * Mirrors StoriesListClient (Plan 02). URL state: page, page_size, q, status,
 * sort, order. Filter changes reset page=1; sort changes do not.
 *
 * Bulk selection (D-02): page-scoped useBulkSelection<number>(). BulkActionToolbar
 * mounted above the table; clicking publish/unpublish opens BulkStatusSheet.
 *
 * Empty state: role-aware (admin + filters → empty_filtered; admin + none → empty_state).
 * Curator/teacher land on this page only via direct URL — RBAC at admin-api returns 403
 * and the list query throws; we render a friendly EmptyState.
 */
export function BannersListClient() {
    const t = useTranslations('admin.banners');

    const [{ page, page_size, status, q, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
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
        () => ['admin.banners.list', { page, page_size, status, q, sort, order }] as const,
        [page, page_size, status, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listBanners({
                page,
                page_size,
                status: (status as BannerStatus | null) ?? undefined,
                q: q ?? undefined,
                sort: (sort as 'created_at' | 'updated_at' | 'visit_count') ?? undefined,
                order: (order as 'asc' | 'desc') ?? undefined,
            }),
        placeholderData: (prev) => prev,
        enabled: !me.isLoading && isAdmin,
    });

    const rows: BannerRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(status || (q && q.trim().length > 0));

    const selection = useBulkSelection<number>();

    const [createOpen, setCreateOpen] = useState(false);
    const [editBanner, setEditBanner] = useState<BannerDetail | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<BannerRow | null>(null);
    const [bulkSheet, setBulkSheet] = useState<{ open: boolean; target: BannerStatus }>({
        open: false,
        target: 'publish',
    });

    const onEdit = async (row: BannerRow) => {
        try {
            const detail = await getBanner(row.id);
            setEditBanner(detail);
            setEditOpen(true);
        } catch (e) {
            // surface as toast inside dialog; here just no-op
            console.error(e);
        }
    };

    const selectedIds = useMemo(() => Array.from(selection.selected), [selection.selected]);

    const emptyTitle = anyFilterActive ? t('empty_filtered') : t('empty_state');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={isAdmin ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
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
                <BannersFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as BannerStatus | null) ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                        })
                    }
                />
            </Card>

            <BulkActionToolbar selectedCount={selection.selectedCount} onClear={() => selection.clear()}>
                <Button size='sm' onClick={() => setBulkSheet({ open: true, target: 'publish' })}>
                    {t('publish_action_short')}
                </Button>
                <Button size='sm' variant='outline' onClick={() => setBulkSheet({ open: true, target: 'pending' })}>
                    {t('unpublish_action_short')}
                </Button>
            </BulkActionToolbar>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={ImageIcon} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={ImageIcon} title={emptyTitle} />
                ) : (
                    <BannersTable
                        rows={rows}
                        loading={isLoading}
                        selection={selection}
                        onEdit={(r) => void onEdit(r)}
                        onDelete={(r) => setDeleteRow(r)}
                    />
                )}
            </Card>

            <UpsertBannerDialog open={createOpen} onOpenChange={setCreateOpen} banner={null} />
            <UpsertBannerDialog
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) setEditBanner(null);
                }}
                banner={editBanner}
            />
            <DeleteBannerDialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
                banner={deleteRow}
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
