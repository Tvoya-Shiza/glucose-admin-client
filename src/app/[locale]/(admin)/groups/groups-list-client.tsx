'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { UsersRound } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { listGroups } from '@/lib/groups/api';
import type { GroupSortField, GroupStatus, MemberCountBucket, SortOrder } from '@/lib/groups/types';
import { CreateGroupDialog } from './components/create-group-dialog';
import { DeleteGroupDialog } from './components/delete-group-dialog';
import { GroupsFilters } from './groups-filters';
import { GroupsTable } from './groups-table';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * GRP-01 — TanStack-Query-driven groups list page with nuqs URL state.
 *
 * URL state keys (D-02): page, page_size, status, supervisor_id, member_count_bucket,
 * q, sort, order. Filter changes reset page=1; sort changes do not.
 *
 * Empty state (D-04) is role-aware:
 *   - admin + filters active -> 'empty_admin_filtered'
 *   - admin + no filters     -> 'empty_admin'
 *   - curator/teacher        -> 'empty_curator' (curator narrowing or default-deny)
 *
 * Create button visible only to admin actors (decided by `/api/auth/me`). Delete
 * dialog opens from row dropdown — also admin-only.
 *
 * Plan 03 owns the detail page at /[locale]/groups/[id]; row links go there.
 */
export function GroupsListClient() {
    const t = useTranslations('admin.groups');

    const [{ page, page_size, status, supervisor_id, member_count_bucket, q, sort, order }, setQ] =
        useQueryStates({
            page: parseAsInteger.withDefault(1),
            page_size: parseAsInteger.withDefault(50),
            status: parseAsString,
            supervisor_id: parseAsInteger,
            member_count_bucket: parseAsString,
            q: parseAsString,
            sort: parseAsString.withDefault('created_at'),
            order: parseAsString.withDefault('desc'),
        });

    // Role detection — drives Create button + Delete dropdown visibility.
    // Cached aggressively because role doesn't change mid-session.
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
    const isCurator = role === 'curator';

    const queryKey = useMemo(
        () =>
            [
                'admin.groups.list',
                {
                    page,
                    page_size,
                    status,
                    supervisor_id,
                    member_count_bucket,
                    q,
                    sort,
                    order,
                },
            ] as const,
        [page, page_size, status, supervisor_id, member_count_bucket, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listGroups({
                page,
                page_size,
                status: (status as GroupStatus | null) ?? undefined,
                supervisor_id: supervisor_id ?? undefined,
                member_count_bucket: (member_count_bucket as MemberCountBucket | null) ?? undefined,
                q: q ?? undefined,
                sort: sort as GroupSortField,
                order: order as SortOrder,
            }),
        // Subsequent filter changes do not flash the skeleton.
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(
        status || supervisor_id || member_count_bucket || (q && q.trim().length > 0),
    );

    // Dialog state — local UI, not URL-stored.
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Role-aware empty-state title (D-04).
    const emptyTitle = isAdmin
        ? anyFilterActive
            ? t('empty_admin_filtered')
            : t('empty_admin')
        : t('empty_curator');

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
                <GroupsFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as GroupStatus | null) ?? undefined,
                        supervisor_id: supervisor_id ?? undefined,
                        member_count_bucket:
                            (member_count_bucket as MemberCountBucket | null) ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            supervisor_id: next.supervisor_id ?? null,
                            member_count_bucket: next.member_count_bucket ?? null,
                        })
                    }
                />
            </Card>
            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={UsersRound} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={UsersRound} title={emptyTitle} />
                ) : (
                    <GroupsTable
                        rows={rows}
                        loading={isLoading}
                        isAdmin={isAdmin}
                        onDelete={(id) => setDeleteId(id)}
                    />
                )}
            </Card>

            {isAdmin ? (
                <>
                    <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
                    <DeleteGroupDialog
                        open={deleteId !== null}
                        onOpenChange={(o) => {
                            if (!o) setDeleteId(null);
                        }}
                        groupId={deleteId}
                    />
                </>
            ) : null}
            <span hidden aria-hidden data-curator={isCurator ? '1' : '0'} />
        </PageShell>
    );
}
