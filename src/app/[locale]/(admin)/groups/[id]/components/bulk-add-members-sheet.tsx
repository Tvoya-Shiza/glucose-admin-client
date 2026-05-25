'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DryRunDialog } from '@/components/users/dry-run-dialog';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useDryRunPreview } from '@/hooks/use-dry-run-preview';
import { bulkAddMembers } from '@/lib/groups/api';
import { listUsers } from '@/lib/users/api';
import type { UserRow } from '@/lib/users/types';

export interface BulkAddMembersSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: number;
}

/**
 * GRP-03 — admin-only bulk-add-members sheet (Plan 04, mirrors Phase 3 BulkGrantSheet).
 *
 * UX:
 *   1. Sheet opens with an embedded user-picker (calls listUsers with role_name='user'
 *      + status='active' + free-text search). Page-scoped checkbox + selection.
 *      Note: glucose legacy data stores learners as role_name='user' (not 'student');
 *      the rest of admin-client uses 'student' as the type literal because the schema
 *      contract was designed forward-looking, but the live users table only has 'user'.
 *   2. User clicks "Preview" -> useDryRunPreview hits POST /:id/members with mode='dry_run'.
 *   3. DryRunDialog shows the affected/insert/skip/error counts; gates >50 commits behind
 *      TypeTheCountConfirmation.
 *   4. Commit -> bulkAddMembers with mode='commit', confirmed_count=dryRun.affected.
 *   5. On success: invalidate ['admin.groups.members', groupId] + ['admin.groups.detail',
 *      groupId] (member_count changes), toast, close sheet.
 *
 * Phase 3 abstractions reused VERBATIM (no re-implementation):
 *   - useDryRunPreview (generic dry-run hook)
 *   - useBulkSelection<number> (page-scoped user-picker selection)
 *   - DryRunDialog (preview UI + threshold gate)
 *   - TypeTheCountConfirmation (engaged inside DryRunDialog when affected > 50)
 *
 * Note: the dry-run + commit endpoints share the same shape (POST /members, mode in body).
 * Admin-api enforces idempotency (skip already-members) + the 1000 user_ids cap +
 * the >50 confirmation gate independently of the UI.
 */
export function BulkAddMembersSheet({ open, onOpenChange, groupId }: BulkAddMembersSheetProps) {
    const t = useTranslations('admin.groups');
    const tUsers = useTranslations('admin.users');
    const qc = useQueryClient();

    // User-picker state (separate selection set so the parent MembersTab's selection
    // doesn't get polluted with user-pick scratch state).
    const pickSelection = useBulkSelection<number>();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const page_size = 50;

    const [dryRunOpen, setDryRunOpen] = useState(false);
    const [bulkOpId, setBulkOpId] = useState<string | null>(null);
    const dryRun = useDryRunPreview();

    // Reset everything when the sheet closes so re-open is fresh.
    useEffect(() => {
        if (!open) {
            pickSelection.clear();
            setSearch('');
            setPage(1);
            setDryRunOpen(false);
            setBulkOpId(null);
            dryRun.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const usersQuery = useQuery({
        queryKey: ['admin.users.picker', groupId, page, page_size, search],
        queryFn: () =>
            listUsers({
                page,
                page_size,
                role_name: 'user',
                status: 'active',
                q: search || undefined,
                sort: 'created_at',
                order: 'desc',
            }),
        enabled: open, // do not preload; only when sheet is open
    });

    const rows: UserRow[] = usersQuery.data?.rows ?? [];
    const idRows = rows.map((r) => ({ id: r.id }));
    const isPageAllSelected = pickSelection.isPageAllSelected(idRows);
    const selectedUserIds = Array.from(pickSelection.selected);

    const onPreview = async () => {
        if (selectedUserIds.length === 0) {
            toast.error(t('error_generic'));
            return;
        }
        await dryRun.run({
            endpoint: `/api/proxy/v1/admin/groups/${groupId}/members`,
            body: { mode: 'dry_run', user_ids: selectedUserIds },
        });
        const result = dryRun.data as unknown as { bulk_op_id?: string } | null;
        if (result?.bulk_op_id) setBulkOpId(result.bulk_op_id);
        setDryRunOpen(true);
    };

    const commit = useMutation({
        mutationFn: () =>
            bulkAddMembers(groupId, {
                mode: 'commit',
                user_ids: selectedUserIds,
                bulk_op_id: bulkOpId ?? undefined,
                confirmed_count: dryRun.data?.affected,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.groups.members', groupId], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.groups.detail', groupId] });
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            toast.success(t('saved'));
            setDryRunOpen(false);
            onOpenChange(false);
        },
        onError: (err: Error) => {
            const msg = err.message ?? '';
            // Server-side >50 confirmation gate could fire if dry-run was stale; refetch.
            if (msg.includes('confirmation_required')) {
                toast.error(msg);
                dryRun.reset();
                setDryRunOpen(false);
                return;
            }
            toast.error(msg || t('error_generic'));
        },
    });

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className='w-[520px] sm:max-w-[520px]'>
                    <SheetHeader>
                        <SheetTitle>{t('bulk_add_members')}</SheetTitle>
                        <SheetDescription>
                            {tUsers('bulk_selected', { count: selectedUserIds.length })}
                        </SheetDescription>
                    </SheetHeader>
                    <div className='space-y-3 px-4 pb-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='picker-search'>{tUsers('search_placeholder')}</Label>
                            <Input
                                id='picker-search'
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                placeholder={tUsers('search_placeholder')}
                            />
                        </div>

                        <div className='max-h-72 overflow-auto rounded-md border'>
                            <table className='w-full text-sm'>
                                <thead className='border-b bg-muted/40'>
                                    <tr>
                                        <th className='w-10 p-2 text-left'>
                                            <Checkbox
                                                checked={isPageAllSelected}
                                                onCheckedChange={() =>
                                                    pickSelection.togglePageScoped(idRows)
                                                }
                                                aria-label='select page'
                                            />
                                        </th>
                                        <th className='p-2 text-left'>{tUsers('col_name')}</th>
                                        <th className='p-2 text-left'>{tUsers('col_email')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usersQuery.isLoading ? (
                                        <tr>
                                            <td colSpan={3} className='p-4 text-muted-foreground'>
                                                {tUsers('loading')}
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className='p-4 text-muted-foreground'>
                                                {tUsers('empty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r) => (
                                            <tr key={r.id} className='border-b last:border-0'>
                                                <td className='p-2'>
                                                    <Checkbox
                                                        checked={pickSelection.isSelected(r.id)}
                                                        onCheckedChange={() =>
                                                            pickSelection.toggle(r.id)
                                                        }
                                                        aria-label={`select ${r.id}`}
                                                    />
                                                </td>
                                                <td className='p-2'>{r.full_name ?? '—'}</td>
                                                <td className='p-2 text-muted-foreground'>
                                                    {r.email ?? '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    ‹
                                </Button>
                                <span className='text-xs text-muted-foreground'>
                                    {page} / {Math.max(1, Math.ceil((usersQuery.data?.total ?? 0) / page_size))}
                                </span>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={page * page_size >= (usersQuery.data?.total ?? 0)}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    ›
                                </Button>
                            </div>
                            <div className='text-xs text-muted-foreground'>
                                {tUsers('bulk_selected', { count: selectedUserIds.length })}
                            </div>
                        </div>

                        <div className='flex justify-end gap-2 pt-2'>
                            <Button variant='outline' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button
                                onClick={onPreview}
                                disabled={dryRun.status === 'loading' || selectedUserIds.length === 0}
                            >
                                {dryRun.status === 'loading' ? t('loading') : t('bulk_dry_run')}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <DryRunDialog
                open={dryRunOpen}
                onOpenChange={(o) => {
                    setDryRunOpen(o);
                    if (!o) dryRun.reset();
                }}
                result={dryRun.data}
                onConfirm={() => commit.mutate()}
                threshold={50}
            />
        </>
    );
}
