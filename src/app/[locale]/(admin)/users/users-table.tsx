'use client';

import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UseBulkSelectionApi } from '@/hooks/use-bulk-selection';
import { usePermission } from '@/lib/access/use-permission';
import { formatUnixDate, roleLabelKey, statusLabelKey } from '@/lib/users/format';
import { formatPhoneDisplay } from '@/lib/users/phone';
import type { UserRow } from '@/lib/users/types';

export interface UsersTableProps {
    rows: UserRow[];
    loading: boolean;
    selection: UseBulkSelectionApi<number>;
    /** Open the change-status dialog for a row. */
    onEditStatus: (row: UserRow) => void;
    /** Open the delete-confirmation dialog for a row. */
    onDelete: (row: UserRow) => void;
    /** Skeleton row count on first paint. Default 10 (D-05). */
    skeletonRowCount?: number;
}

/**
 * Users table (D-01) — TanStack-Table-shaped cells over shadcn `<Table>` primitives.
 *
 * Uses `useBulkSelection.togglePageScoped(rows)` for the header checkbox so selection
 * is page-scoped (D-12, USR-05) — there is NO global "select all 12k" affordance.
 * Each row links to /[locale]/users/[id] (Plan 03 owns the detail page).
 */
export function UsersTable({
    rows,
    loading,
    selection,
    onEditStatus,
    onDelete,
    skeletonRowCount = 10,
}: UsersTableProps) {
    const t = useTranslations('admin.users');
    const locale = useLocale();
    const isPageAllSelected = selection.isPageAllSelected(rows);

    // Row actions are permission-gated; the whole Actions column hides when the actor
    // can neither edit nor delete (admins/is_super pass both). usePermission is
    // deny-during-load so SSR and CSR agree (no hydration mismatch).
    const canEdit = usePermission('users.edit');
    const canDelete = usePermission('users.delete');
    const showActions = canEdit || canDelete;
    const colCount = showActions ? 10 : 9;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-10'>
                        <Checkbox
                            checked={isPageAllSelected}
                            onCheckedChange={() => selection.togglePageScoped(rows)}
                            aria-label='select page'
                        />
                    </TableHead>
                    <TableHead>{t('col_name')}</TableHead>
                    <TableHead>{t('col_email')}</TableHead>
                    <TableHead>{t('col_mobile')}</TableHead>
                    <TableHead>{t('col_role')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead className='text-right'>{t('col_groups')}</TableHead>
                    <TableHead>{t('col_last_activity')}</TableHead>
                    <TableHead>{t('col_created')}</TableHead>
                    {showActions ? <TableHead className='w-10' /> : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={colCount}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => (
                          <TableRow key={r.id}>
                              <TableCell>
                                  <Checkbox
                                      checked={selection.isSelected(r.id)}
                                      onCheckedChange={() => selection.toggle(r.id)}
                                      aria-label={`select ${r.id}`}
                                  />
                              </TableCell>
                              <TableCell>
                                  <Link
                                      href={`/${locale}/users/${r.id}`}
                                      className='font-medium hover:underline'
                                  >
                                      {r.full_name ?? '—'}
                                  </Link>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.email ?? '—'}
                              </TableCell>
                              <TableCell className='font-mono text-xs'>{formatPhoneDisplay(r.mobile) || '—'}</TableCell>
                              <TableCell>
                                  <Badge variant='outline'>{t(roleLabelKey(r.role_name))}</Badge>
                              </TableCell>
                              <TableCell>
                                  <Badge
                                      variant={
                                          r.status === 'active'
                                              ? 'default'
                                              : r.status === 'pending'
                                              ? 'secondary'
                                              : 'outline'
                                      }
                                  >
                                      {t(statusLabelKey(r.status))}
                                  </Badge>
                              </TableCell>
                              <TableCell className='text-right tabular-nums'>{r.group_count}</TableCell>
                              <TableCell className='text-sm'>
                                  {formatUnixDate(r.last_activity, locale)}
                              </TableCell>
                              <TableCell className='text-sm'>
                                  {formatUnixDate(r.created_at, locale)}
                              </TableCell>
                              {showActions ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button
                                                  variant='ghost'
                                                  size='icon'
                                                  aria-label={t('row_actions')}
                                              >
                                                  <MoreHorizontalIcon className='h-4 w-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              {canEdit ? (
                                                  <DropdownMenuItem onClick={() => onEditStatus(r)}>
                                                      {t('edit_status')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                              {canDelete ? (
                                                  <DropdownMenuItem
                                                      onClick={() => onDelete(r)}
                                                      className='text-destructive'
                                                  >
                                                      {t('delete')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </TableCell>
                              ) : null}
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}
