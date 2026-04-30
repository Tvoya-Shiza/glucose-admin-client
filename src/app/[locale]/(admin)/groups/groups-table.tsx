'use client';

import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixSecondsOrDash, statusBadgeVariant } from '@/lib/groups/format';
import type { GroupRow } from '@/lib/groups/types';

export interface GroupsTableProps {
    rows: GroupRow[];
    loading: boolean;
    /** Whether to show the admin-only Actions column (Delete dropdown). */
    isAdmin: boolean;
    /** Open the delete dialog for a given group id. */
    onDelete: (groupId: number) => void;
    /** Skeleton row count on first paint. Default 10. */
    skeletonRowCount?: number;
}

/**
 * Groups table (D-01) — TanStack-Table-shaped cells over shadcn `<Table>` primitives.
 *
 * Each row's name cell links to /[locale]/groups/[id] — Plan 03 owns the detail page.
 * Action menu (Delete) renders only for admin actors; curators never see it. The Edit
 * action lives on the detail page (Plan 03 owns the edit-in-place pattern), so the
 * dropdown contains only Delete in this plan.
 *
 * created_at column shows '—' for every row in Phase 4 (Group has no created_at column —
 * Plan 01 schema-gap note); the column is preserved so Plan-future schema landings drop
 * straight in without UI changes.
 */
export function GroupsTable({ rows, loading, isAdmin, onDelete, skeletonRowCount = 10 }: GroupsTableProps) {
    const t = useTranslations('admin.groups');
    const locale = useLocale() as 'ru' | 'kz';

    const columnCount = isAdmin ? 6 : 5;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_name')}</TableHead>
                    <TableHead>{t('col_supervisor')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead className='text-right'>{t('col_members')}</TableHead>
                    <TableHead>{t('col_created')}</TableHead>
                    {isAdmin ? <TableHead className='w-12'>{t('actions')}</TableHead> : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={columnCount}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => (
                          <TableRow key={r.id}>
                              <TableCell>
                                  <Link
                                      href={`/${locale}/groups/${r.id}`}
                                      className='font-medium hover:underline'
                                  >
                                      {r.name}
                                  </Link>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.supervisor?.full_name ?? (
                                      <Badge variant='outline'>{t('supervisor_unassigned')}</Badge>
                                  )}
                              </TableCell>
                              <TableCell>
                                  <Badge variant={statusBadgeVariant(r.status)}>
                                      {t(`status_${r.status}`)}
                                  </Badge>
                              </TableCell>
                              <TableCell className='text-right tabular-nums'>{r.member_count}</TableCell>
                              <TableCell className='text-sm'>
                                  {formatUnixSecondsOrDash(r.created_at, locale)}
                              </TableCell>
                              {isAdmin ? (
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
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/${locale}/groups/${r.id}`}>
                                                      {t('view_detail')}
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                  onClick={() => onDelete(r.id)}
                                                  className='text-destructive'
                                              >
                                                  {t('delete')}
                                              </DropdownMenuItem>
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
