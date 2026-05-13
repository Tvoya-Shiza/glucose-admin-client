'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BulkActionToolbar } from '@/components/users/bulk-action-toolbar';
import { EmptyState } from '@/components/users/empty-state';
import { Button } from '@/components/ui/button';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listUsers } from '@/lib/users/api';
import type { UserStatus } from '@/lib/users/types';
import { BulkGrantSheet } from './components/bulk-grant-sheet';
import { CreateUserDialog } from './components/create-user-dialog';
import { ExportButton } from './components/export-button';
import { UsersFilters } from './users-filters';
import { UsersTable } from './users-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * USR-01 — TanStack-Query-driven list page with nuqs URL state.
 *
 * URL state keys (D-02): page, page_size, role_name, status, region_id, q, sort, order.
 * URL survives reload + is shareable. Filter changes reset page=1; sort changes do not.
 *
 * Loading posture (D-05): first paint shows 10 skeleton rows; subsequent filter/page
 * changes refetch silently while the previous data stays mounted (`placeholderData`).
 *
 * Empty state (D-06): copy varies by whether any filter is active. Both copies live
 * under `admin.users.empty*` (RU + KZ).
 */
export function UsersListClient() {
    const t = useTranslations('admin.users');

    const [{ page, page_size, role_name, status, region_id, q, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        role_name: parseAsString,
        status: parseAsString,
        region_id: parseAsInteger,
        q: parseAsString,
        sort: parseAsString.withDefault('created_at'),
        order: parseAsString.withDefault('desc'),
    });

    const queryKey = useMemo(
        () => ['admin.users.list', { page, page_size, role_name, status, region_id, q, sort, order }] as const,
        [page, page_size, role_name, status, region_id, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listUsers({
                page,
                page_size,
                role_name: role_name ?? undefined,
                status: (status as UserStatus | null) ?? undefined,
                region_id: region_id ?? undefined,
                q: q ?? undefined,
                sort: sort as 'created_at' | 'full_name' | 'last_activity',
                order: order as 'asc' | 'desc',
            }),
        // Subsequent filter changes do not flash the skeleton: data stays visible while refetching.
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;
    const selection = useBulkSelection<number>();

    const anyFilterActive = Boolean(role_name || status || region_id || (q && q.trim().length > 0));

    // Role detection — gates the "Create user" button (admin-only).
    const me = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    // Defer conditional UI until after hydration. SSR has no /api/auth/me result, but
    // a warm TanStack Query cache may resolve it synchronously on the client — that
    // mismatch was triggering "data-slot=button vs data-slot=dropdown-menu-trigger"
    // hydration errors when the Create button shifted ExportButton's DOM position.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const isAdmin = mounted && me.data?.data?.role_name === 'admin';

    // Plan 05: bulk-grant flow. Sheet opens from BulkActionToolbar; on commit, list
    // query is invalidated (inside BulkGrantSheet) and selection is cleared here.
    const [bulkOpen, setBulkOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const selectedUserIds = useMemo(() => Array.from(selection.selected), [selection.selected]);

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('list_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('list_subtitle')}</p>
                </div>
                <div className='flex items-center gap-2'>
                    {isAdmin ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
                    <ExportButton
                        filters={{
                            role_name: role_name ?? undefined,
                            status: (status as 'active' | 'inactive' | 'pending' | null) ?? undefined,
                            region_id: region_id ?? undefined,
                            q: q ?? undefined,
                            sort: sort as 'created_at' | 'full_name' | 'last_activity',
                            order: order as 'asc' | 'desc',
                        }}
                    />
                </div>
            </header>
            <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
            <UsersFilters
                value={{
                    q: q ?? undefined,
                    role_name: role_name ?? undefined,
                    status: (status as UserStatus | null) ?? undefined,
                }}
                onChange={(next) =>
                    setQ({
                        page: 1,
                        q: next.q ?? null,
                        role_name: next.role_name ?? null,
                        status: next.status ?? null,
                    })
                }
            />
            <BulkActionToolbar selectedCount={selection.selectedCount} onClear={selection.clear}>
                <Button size='sm' onClick={() => setBulkOpen(true)} disabled={selection.selectedCount === 0}>
                    {t('bulk_grant_access')}
                </Button>
            </BulkActionToolbar>
            <BulkGrantSheet
                open={bulkOpen}
                onOpenChange={setBulkOpen}
                selectedUserIds={selectedUserIds}
                onCommitted={() => selection.clear()}
            />
            <div className='flex-1 overflow-auto'>
                {error ? (
                    <EmptyState title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState title={t(anyFilterActive ? 'empty' : 'empty_no_filters')} />
                ) : (
                    <UsersTable rows={rows} loading={isLoading} selection={selection} />
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
        </div>
    );
}
