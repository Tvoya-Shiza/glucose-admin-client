'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { Ticket } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { usePermission } from '@/lib/access/use-permission';
import { getPromocode, listPromocodes } from '@/lib/promocodes/api';
import type { DiscountType, PromocodeDetail, PromocodeRow } from '@/lib/promocodes/types';
import { DeletePromocodeDialog } from './components/delete-promocode-dialog';
import { UpsertPromocodeDialog } from './components/upsert-promocode-dialog';
import { PromocodesFilters, type StatusWindow } from './promocodes-filters';
import { PromocodesTable } from './promocodes-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * PRM-01 — TanStack-Query-driven promocodes list page with nuqs URL state.
 *
 * URL state: page, page_size, q, discount_type, status_window, is_active, sort, order.
 * Filter changes reset page=1; sort changes do not.
 *
 * NO bulk action toolbar / NO checkbox column (D-13/D-14 — promocodes have no
 * bulk-status flow; their model differs from Stories/Banners/Blogs).
 *
 * Empty state: role-aware (admin + filters → empty_filtered; admin + none →
 * empty_state). Curator/teacher land here only via direct URL — RBAC at admin-api
 * returns 403 and the list query throws; we render a friendly EmptyState.
 */
export function PromocodesListClient() {
    const t = useTranslations('admin.promocodes');
    const locale = useLocale();

    const [{ page, page_size, q, discount_type, status_window, is_active, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        discount_type: parseAsStringEnum<DiscountType>(['percentage', 'fixed']),
        status_window: parseAsStringEnum<StatusWindow>(['active', 'expired', 'future', 'all']),
        is_active: parseAsString, // 'true' | 'false' | null
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
    const canView = usePermission('promocodes.view');
    const canCreate = usePermission('promocodes.create');

    const isActiveBool: boolean | undefined =
        is_active === 'true' ? true : is_active === 'false' ? false : undefined;

    const queryKey = useMemo(
        () =>
            [
                'admin.promocodes.list',
                { page, page_size, q, discount_type, status_window, is_active: isActiveBool, sort, order },
            ] as const,
        [page, page_size, q, discount_type, status_window, isActiveBool, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listPromocodes({
                page,
                page_size,
                q: q ?? undefined,
                discount_type: (discount_type as DiscountType | null) ?? undefined,
                status_window: (status_window as StatusWindow | null) ?? undefined,
                is_active: isActiveBool,
                sort: (sort as 'created_at' | 'expires_at' | 'usage_count') ?? undefined,
                order: (order as 'asc' | 'desc') ?? undefined,
            }),
        placeholderData: (prev) => prev,
        enabled: !me.isLoading && canView,
    });

    const rows: PromocodeRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(
        discount_type || status_window || isActiveBool !== undefined || (q && q.trim().length > 0),
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [editPromocode, setEditPromocode] = useState<PromocodeDetail | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<PromocodeRow | null>(null);

    const onEdit = async (row: PromocodeRow) => {
        try {
            const detail = await getPromocode(row.id);
            setEditPromocode(detail);
            setEditOpen(true);
        } catch (e) {
            console.error(e);
        }
    };

    const emptyTitle = anyFilterActive ? t('empty_filtered') : t('empty_state');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={canCreate ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
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
                <PromocodesFilters
                    value={{
                        q: q ?? undefined,
                        discount_type: (discount_type as DiscountType | null) ?? undefined,
                        status_window: (status_window as StatusWindow | null) ?? undefined,
                        is_active: isActiveBool,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            discount_type: next.discount_type ?? null,
                            status_window: next.status_window ?? null,
                            is_active:
                                next.is_active === undefined ? null : next.is_active ? 'true' : 'false',
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Ticket} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Ticket} title={emptyTitle} />
                ) : (
                    <PromocodesTable
                        rows={rows}
                        loading={isLoading}
                        locale={locale}
                        onEdit={(r) => void onEdit(r)}
                        onDelete={(r) => setDeleteRow(r)}
                    />
                )}
            </Card>

            <UpsertPromocodeDialog open={createOpen} onOpenChange={setCreateOpen} promocode={null} />
            <UpsertPromocodeDialog
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) setEditPromocode(null);
                }}
                promocode={editPromocode}
            />
            <DeletePromocodeDialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
                promocode={deleteRow}
            />
        </PageShell>
    );
}
