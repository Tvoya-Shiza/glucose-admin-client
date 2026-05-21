'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { toast } from 'sonner';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermission } from '@/lib/access/use-permission';
import { listCourseAccessors, revokeAccess } from '@/lib/course-access/api';
import { formatScheduleDate } from '@/lib/schedules/format';
import type { CourseAccessorRow } from '@/lib/course-access/types';
import { ExtendCourseAccessDialog } from '../../../groups/[id]/components/extend-course-access-dialog';

export interface AccessorsTableProps {
    courseId: number;
}

/**
 * Phase 19 / Feature C — unified accessors list (direct + via-group) for one course.
 *
 * Filters (nuqs URL state): page, page_size, q, source ('direct'|'group'|null).
 * The 'group_id' filter is supported by the API but not exposed here yet —
 * operators currently navigate via the Groups tab when they want to inspect a
 * specific group's footprint.
 *
 * Actions per row:
 *   • Extend / Revoke — only on 'direct' rows. Group rows show both buttons
 *     disabled with a tooltip "manage in the group's card", because mutating
 *     a group's sale would affect every member.
 *   • The page header has a "Grant access" button (gated by course_access.grant)
 *     that opens GrantDirectAccessDialog. The dialog is owned by the parent
 *     `accessors-tab.tsx` so the table itself stays focused on rendering.
 */
export function AccessorsTable({ courseId }: AccessorsTableProps) {
    const t = useTranslations('admin.course_access');
    const locale = useLocale();
    const qc = useQueryClient();
    const canExtend = usePermission('course_access.extend');
    const canRevoke = usePermission('course_access.revoke');

    const [{ page, page_size, q, source }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        source: parseAsString,
    });

    const invalidateKey = ['admin.course-access.accessors', courseId] as const;
    const listKey = [...invalidateKey, { page, page_size, q, source }] as const;

    const { data, isLoading, isFetching } = useQuery({
        queryKey: listKey,
        queryFn: () =>
            listCourseAccessors(courseId, {
                page,
                page_size,
                q: q ?? undefined,
                source: source === 'direct' || source === 'group' ? source : undefined,
            }),
        staleTime: 15_000,
    });

    const rows: CourseAccessorRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const [extendRow, setExtendRow] = useState<CourseAccessorRow | null>(null);
    const [revokeRow, setRevokeRow] = useState<CourseAccessorRow | null>(null);

    const revokeMutation = useMutation({
        mutationFn: (saleId: number) => revokeAccess(saleId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: invalidateKey, exact: false });
            toast.success(t('revoked_toast'));
            setRevokeRow(null);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('already_revoked')) toast.error(t('error_already_revoked'));
            else if (msg.includes('sale_not_found') || msg.includes('404')) toast.error(t('error_sale_not_found'));
            else toast.error(t('error_generic'));
        },
    });

    return (
        <div className='space-y-3'>
            <div className='flex flex-wrap items-end gap-2'>
                <Input
                    placeholder={t('search_placeholder')}
                    value={q ?? ''}
                    onChange={(e) => setQ({ page: 1, q: e.target.value || null })}
                    className='max-w-xs'
                />
                <Select
                    value={source ?? 'all'}
                    onValueChange={(v) =>
                        setQ({ page: 1, source: v === 'all' ? null : v })
                    }
                >
                    <SelectTrigger className='w-44'>
                        <SelectValue placeholder={t('filter_source')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('filter_source_all')}</SelectItem>
                        <SelectItem value='direct'>{t('source_direct')}</SelectItem>
                        <SelectItem value='group'>{t('source_group')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <Skeleton className='h-64 w-full' />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('col_user')}</TableHead>
                            <TableHead>{t('col_source')}</TableHead>
                            <TableHead>{t('col_granted_at')}</TableHead>
                            <TableHead>{t('col_expires_at')}</TableHead>
                            <TableHead>{t('col_days_remaining')}</TableHead>
                            <TableHead>{t('col_last_activity')}</TableHead>
                            <TableHead className='text-right'>{t('col_actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className='text-center text-muted-foreground'>
                                    {t('accessors_empty')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((r) => {
                                const isGroup = r.source.kind === 'group';
                                const extendDisabled = isGroup || !canExtend;
                                const revokeDisabled = isGroup || !canRevoke;
                                return (
                                    <TableRow key={`${r.user.id}-${r.sale_id}`}>
                                        <TableCell>
                                            <div className='font-medium'>{r.user.full_name ?? `#${r.user.id}`}</div>
                                            <div className='text-xs text-muted-foreground'>
                                                {r.user.email ?? r.user.mobile ?? '—'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isGroup ? (
                                                <Badge variant='secondary'>
                                                    {t('source_group_label', { name: r.source.group_name ?? '—' })}
                                                </Badge>
                                            ) : (
                                                <Badge>{t('source_direct')}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className='text-xs'>
                                            {formatScheduleDate(r.granted_at, locale)}
                                        </TableCell>
                                        <TableCell className='text-xs'>
                                            {r.expires_at == null ? (
                                                <span className='text-muted-foreground'>{t('perpetual')}</span>
                                            ) : (
                                                formatScheduleDate(r.expires_at, locale)
                                            )}
                                        </TableCell>
                                        <TableCell className='text-xs font-mono'>
                                            {r.days_remaining == null
                                                ? '∞'
                                                : r.days_remaining === 0
                                                  ? t('expired')
                                                  : r.days_remaining}
                                        </TableCell>
                                        <TableCell className='text-xs'>
                                            {r.last_course_activity == null
                                                ? '—'
                                                : formatScheduleDate(r.last_course_activity, locale)}
                                        </TableCell>
                                        <TableCell className='space-x-2 text-right'>
                                            <ActionButton
                                                label={t('extend')}
                                                disabled={extendDisabled}
                                                tooltip={isGroup ? t('manage_in_group') : undefined}
                                                onClick={() => setExtendRow(r)}
                                            />
                                            <ActionButton
                                                label={t('revoke')}
                                                variant='destructive'
                                                disabled={revokeDisabled}
                                                tooltip={isGroup ? t('manage_in_group') : undefined}
                                                onClick={() => setRevokeRow(r)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            )}

            <DataTablePagination
                page={page}
                pageSize={page_size}
                total={total}
                rowCount={rows.length}
                isFetching={isFetching}
                onPageChange={(p) => setQ({ page: p })}
                onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
            />

            {extendRow ? (
                <ExtendCourseAccessDialog
                    open
                    onOpenChange={(open) => !open && setExtendRow(null)}
                    saleId={extendRow.sale_id}
                    currentExpiresAt={extendRow.expires_at}
                    courseTitle={extendRow.user.full_name ?? `#${extendRow.user.id}`}
                    invalidateKey={invalidateKey}
                />
            ) : null}

            <Dialog open={!!revokeRow} onOpenChange={(open) => !open && setRevokeRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('revoke_confirm_title')}</DialogTitle>
                        <DialogDescription>
                            {revokeRow ? (
                                <span>
                                    {t('revoke_confirm_user_body', {
                                        user: revokeRow.user.full_name ?? `#${revokeRow.user.id}`,
                                    })}
                                </span>
                            ) : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setRevokeRow(null)}
                            disabled={revokeMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            onClick={() => revokeRow && revokeMutation.mutate(revokeRow.sale_id)}
                            disabled={revokeMutation.isPending}
                        >
                            {revokeMutation.isPending ? t('loading') : t('revoke')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface ActionButtonProps {
    label: string;
    variant?: 'outline' | 'destructive';
    disabled?: boolean;
    tooltip?: string;
    onClick: () => void;
}

function ActionButton({ label, variant = 'outline', disabled, tooltip, onClick }: ActionButtonProps) {
    const btn = (
        <Button size='sm' variant={variant} onClick={onClick} disabled={disabled}>
            {label}
        </Button>
    );
    if (!tooltip || !disabled) return btn;
    // When disabled, Button's pointer-events:none prevents Tooltip's hover detection.
    // Wrap in a span with pointer-events:auto for the tooltip target.
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span tabIndex={0} className='inline-block'>
                    {btn}
                </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
