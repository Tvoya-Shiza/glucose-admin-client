'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkActionToolbar } from '@/components/users/bulk-action-toolbar';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { usePermission } from '@/lib/access/use-permission';
import { getMemberProgress, listGroupMembers } from '@/lib/groups/api';
import type { ActivityWindow, MemberProgressRow, MemberRow } from '@/lib/groups/types';
import { BulkAddMembersSheet } from '../components/bulk-add-members-sheet';
import { BulkRemoveMembersButton } from '../components/bulk-remove-members-button';
import { MembersTable } from '../components/members-table';

const ACTIVITY_WINDOWS: ActivityWindow[] = ['1d', '7d', '30d', 'all'];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: 'admin' | 'curator' | 'teacher' };
}

/**
 * GRP-03 + GRP-06 — Members tab body for the group-detail page (Plan 04, replaces
 * the Plan 03 placeholder).
 *
 * Composition:
 *   - Activity window selector (1d/7d/30d/all, default 7d per CONTEXT D-20). URL state
 *     via nuqs `?window=`. Filters `last_activity` client-side per D-20.
 *   - Free-text name search (server-side, hits listGroupMembers `q=`).
 *   - "Add members" button (admin only) -> BulkAddMembersSheet.
 *   - MembersTable (TanStack-styled rows over shadcn Table primitives).
 *   - BulkActionToolbar (sticky, admin only) -> BulkRemoveMembersButton.
 *   - Pagination (page_size=50, server-side via listGroupMembers).
 *
 * Data flow:
 *   - listGroupMembers query (paginated, debounce-free).
 *   - getMemberProgress query (lazy: only fires when userIds is non-empty AND tab is
 *     mounted). Result is mapped onto rows via a Map<user_id, MemberProgressRow>.
 *
 * Role gating:
 *   - me query (`auth.me`) resolves the actor's role. admin -> bulk add/remove visible.
 *     curator/teacher -> read-only view (table without selection column).
 *
 * The parent `group-detail-client.tsx` lazy-mounts this component (only when `?tab=members`),
 * so the queries here never fire on first paint of the detail page.
 */
export function MembersTab({ groupId }: { groupId: number }) {
    const t = useTranslations('admin.groups');
    const [page, setPage] = useState(1);
    const page_size = 50;
    const [q, setQ] = useState('');
    const [windowFilter, setWindowFilter] = useQueryState(
        'window',
        parseAsStringLiteral(ACTIVITY_WINDOWS).withDefault('7d'),
    );
    const [addSheetOpen, setAddSheetOpen] = useState(false);

    const selection = useBulkSelection<number>();

    // Role detection — drives admin-only UI affordances. Cached for 5 min to match
    // group-detail-client.tsx's lookup.
    const me = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const canMutate = usePermission('groups.edit');

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.groups.members', groupId, page, page_size, q],
        queryFn: () => listGroupMembers(groupId, page, page_size, q || undefined),
    });

    const userIds = useMemo(() => (data?.rows ?? []).map((r) => r.user_id), [data?.rows]);

    const progressQuery = useQuery({
        queryKey: ['admin.groups.members.progress', groupId, userIds.join(',')],
        queryFn: () => getMemberProgress(groupId, userIds),
        enabled: userIds.length > 0,
    });

    const progressByUser = useMemo(() => {
        const m = new Map<number, MemberProgressRow>();
        for (const p of progressQuery.data?.rows ?? []) m.set(p.user_id, p);
        return m;
    }, [progressQuery.data?.rows]);

    // Apply activity window client-side per CONTEXT D-20 (last_activity is in MemberRow).
    const filteredRows: MemberRow[] = useMemo(() => {
        if (!data?.rows) return [];
        if (windowFilter === 'all') return data.rows;
        const days = windowFilter === '1d' ? 1 : windowFilter === '7d' ? 7 : 30;
        const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
        return data.rows.filter((r) => (r.last_activity ?? 0) >= cutoff);
    }, [data?.rows, windowFilter]);

    if (isLoading) {
        return (
            <div className='space-y-2 pt-4'>
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className='h-10' />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className='pt-4'>
                <Alert variant='destructive'>
                    <AlertTitle>{t('error_generic')}</AlertTitle>
                    <AlertDescription>{error instanceof Error ? error.message : ''}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!data || data.rows.length === 0) {
        return (
            <div className='pt-4 space-y-3'>
                <p className='text-sm text-muted-foreground'>{t('empty_admin')}</p>
                {canMutate ? (
                    <Button size='sm' onClick={() => setAddSheetOpen(true)}>
                        {t('bulk_add_members')}
                    </Button>
                ) : null}
                {canMutate ? (
                    <BulkAddMembersSheet
                        open={addSheetOpen}
                        onOpenChange={setAddSheetOpen}
                        groupId={groupId}
                    />
                ) : null}
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(data.total / page_size));

    return (
        <div className='space-y-4 pt-4'>
            <div className='flex flex-wrap items-center gap-2'>
                <select
                    value={windowFilter}
                    onChange={(e) => setWindowFilter(e.target.value as ActivityWindow)}
                    className='rounded-md border bg-background px-2 py-1 text-sm'
                    aria-label={t('last_activity_window')}
                >
                    {ACTIVITY_WINDOWS.map((w) => (
                        <option key={w} value={w}>
                            {t(`last_activity_window_${w}`)}
                        </option>
                    ))}
                </select>
                <Input
                    type='search'
                    placeholder={t('search_placeholder')}
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setPage(1);
                    }}
                    className='max-w-xs'
                />
                {canMutate ? (
                    <Button size='sm' onClick={() => setAddSheetOpen(true)}>
                        {t('bulk_add_members')}
                    </Button>
                ) : null}
            </div>

            {canMutate ? (
                <BulkActionToolbar selectedCount={selection.selectedCount} onClear={selection.clear}>
                    <BulkRemoveMembersButton groupId={groupId} selection={selection} />
                </BulkActionToolbar>
            ) : null}

            <MembersTable
                rows={filteredRows}
                progressByUser={progressByUser}
                selection={selection}
                canSelect={canMutate}
            />

            <div className='flex items-center gap-2'>
                <Button
                    size='sm'
                    variant='outline'
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                    ‹
                </Button>
                <span className='text-sm text-muted-foreground'>
                    {page} / {totalPages}
                </span>
                <Button
                    size='sm'
                    variant='outline'
                    disabled={page * page_size >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                >
                    ›
                </Button>
            </div>

            {canMutate ? (
                <BulkAddMembersSheet
                    open={addSheetOpen}
                    onOpenChange={setAddSheetOpen}
                    groupId={groupId}
                />
            ) : null}
        </div>
    );
}
