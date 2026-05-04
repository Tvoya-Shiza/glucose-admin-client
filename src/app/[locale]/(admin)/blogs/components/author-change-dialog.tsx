'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { changeBlogAuthor } from '@/lib/blogs/api';
import { listUsers } from '@/lib/users/api';
import type { BlogDetail } from '@/lib/blogs/types';
import type { UserRow } from '@/lib/users/types';

export interface AuthorChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    blog: BlogDetail;
    onChanged?: () => void;
}

/**
 * BLG-03 — admin-only blog author reassignment dialog (D-11).
 *
 * Mirrors Phase 3 Plan 04 RoleChangeDialog two-pane state machine:
 *   1. **Default pane:** read-only current author + debounced user-search input
 *      (filtered to admin/teacher roles via the existing GET /admin-api/v1/admin/users
 *      endpoint with `role_name=admin` then `role_name=teacher` — merged client-side)
 *      + reason Textarea (optional) + Save button.
 *   2. **Confirmation pane:** TypeTheCountConfirmation with `count={blog.id}`. Always
 *      engages — author reassignment is on the same trust tier as role change.
 *      Server independently re-validates `confirmation === String(blog.id)` (T-07-04-04).
 *
 * Target picker: simple search-by-name Input → debounced query against listUsers
 * filtered to admin role + teacher role (two parallel queries merged in-memory).
 * Top-10 results render as buttons; click selects.
 *
 * On success: invalidate ['admin.blogs.detail', blog.id] + ['admin.blogs.list'],
 * toast, close, fire onChanged().
 */
export function AuthorChangeDialog({ open, onOpenChange, blog, onChanged }: AuthorChangeDialogProps) {
    const t = useTranslations('admin.blogs');
    const qc = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [target, setTarget] = useState<{ id: number; full_name: string | null; role_name: string } | null>(null);
    const [reason, setReason] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    // Reset on open.
    useEffect(() => {
        if (open) {
            setSearchQuery('');
            setDebouncedQuery('');
            setTarget(null);
            setReason('');
            setShowConfirm(false);
        }
    }, [open, blog.id]);

    // Debounce search.
    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    // Run two parallel queries (admin + teacher) and merge — the existing list endpoint
    // accepts a single role_name filter, so we fetch both buckets and combine.
    const adminQuery = useQuery({
        queryKey: ['admin.users.list', { role_name: 'admin', q: debouncedQuery, page_size: 10 }],
        queryFn: () => listUsers({ role_name: 'admin', q: debouncedQuery || undefined, page_size: 10 }),
        enabled: open && debouncedQuery.length > 0,
        staleTime: 30_000,
    });
    const teacherQuery = useQuery({
        queryKey: ['admin.users.list', { role_name: 'teacher', q: debouncedQuery, page_size: 10 }],
        queryFn: () => listUsers({ role_name: 'teacher', q: debouncedQuery || undefined, page_size: 10 }),
        enabled: open && debouncedQuery.length > 0,
        staleTime: 30_000,
    });

    const candidates: UserRow[] = useMemo(() => {
        const a = adminQuery.data?.rows ?? [];
        const x = teacherQuery.data?.rows ?? [];
        const merged = [...a, ...x];
        // Dedup by id, prefer first occurrence (admin bucket first).
        const seen = new Set<number>();
        const out: UserRow[] = [];
        for (const u of merged) {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                out.push(u);
            }
        }
        return out.slice(0, 10);
    }, [adminQuery.data, teacherQuery.data]);

    const isSearching = adminQuery.isFetching || teacherQuery.isFetching;

    const mutate = useMutation({
        mutationFn: (confirmation: string) =>
            changeBlogAuthor(blog.id, {
                author_id: target!.id,
                reason: reason.trim() || undefined,
                confirmation,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.blogs.detail', blog.id], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.blogs.list'], exact: false });
            toast.success(t('saved'));
            onChanged?.();
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message ?? t('save_failed')),
    });

    const onProceed = () => {
        if (!target) {
            toast.error(t('change_author_target_required'));
            return;
        }
        // Self-loop short-circuit: server returns current state without write, but UX-wise
        // we should let the user know nothing happened.
        if (target.id === blog.author_id) {
            toast.info(t('change_author_already_current'));
            return;
        }
        // Engage type-the-id gate.
        setShowConfirm(true);
    };

    const onConfirm = () => {
        mutate.mutate(String(blog.id));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('change_author_title')}</DialogTitle>
                    <DialogDescription>{t('change_author')}</DialogDescription>
                </DialogHeader>

                {!showConfirm ? (
                    <div className='space-y-3'>
                        <div className='text-sm'>
                            {t('col_author')}: <strong>{blog.author?.full_name ?? `#${blog.author_id}`}</strong>
                            {blog.author?.role_name ? (
                                <span className='text-muted-foreground'> · {blog.author.role_name}</span>
                            ) : null}
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='author-search'>{t('change_author_target')}</Label>
                            <Input
                                id='author-search'
                                placeholder={t('change_author_target_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoComplete='off'
                            />
                            {debouncedQuery.length > 0 ? (
                                <div className='max-h-48 overflow-auto rounded border'>
                                    {isSearching ? (
                                        <p className='p-3 text-xs text-muted-foreground'>...</p>
                                    ) : candidates.length === 0 ? (
                                        <p className='p-3 text-xs text-muted-foreground'>
                                            {t('change_author_search_results')}: 0
                                        </p>
                                    ) : (
                                        candidates.map((u) => {
                                            const selected = target?.id === u.id;
                                            return (
                                                <button
                                                    key={u.id}
                                                    type='button'
                                                    onClick={() =>
                                                        setTarget({
                                                            id: u.id,
                                                            full_name: u.full_name,
                                                            role_name: String(u.role_name),
                                                        })
                                                    }
                                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                                        selected ? 'bg-muted' : ''
                                                    }`}
                                                >
                                                    <span className='truncate'>
                                                        {u.full_name ?? u.email ?? `#${u.id}`}
                                                    </span>
                                                    <span className='text-xs text-muted-foreground'>
                                                        {String(u.role_name)} · #{u.id}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            ) : null}
                        </div>

                        {target ? (
                            <div className='rounded border bg-muted/50 p-2 text-xs'>
                                {t('change_author_target')}:{' '}
                                <strong>{target.full_name ?? `#${target.id}`}</strong> ({target.role_name})
                            </div>
                        ) : null}

                        <div className='space-y-2'>
                            <Label htmlFor='author-reason'>{t('change_author_reason')}</Label>
                            <Textarea
                                id='author-reason'
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                maxLength={500}
                                rows={2}
                            />
                        </div>

                        <DialogFooter>
                            <Button variant='outline' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={onProceed} disabled={!target || mutate.isPending}>
                                {t('save')}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <TypeTheCountConfirmation
                        count={blog.id}
                        helperText={t('type_id_to_confirm_author_change', { id: blog.id })}
                        onConfirm={onConfirm}
                        onCancel={() => setShowConfirm(false)}
                        confirmLabel={mutate.isPending ? t('saving') : t('save')}
                        cancelLabel={t('cancel')}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
