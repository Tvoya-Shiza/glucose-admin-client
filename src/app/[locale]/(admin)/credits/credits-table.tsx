'use client';

import Link from 'next/link';
import { MoreHorizontalIcon, PlayCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import { formatUnixDateTimeOrDash } from '@/lib/credits/format';
import type { CreditRow } from '@/lib/credits/types';
import { CreditStatusBadge } from './[id]/components/credit-status-badge';

export interface CreditsTableProps {
    rows: CreditRow[];
    loading: boolean;
    canConduct: boolean;
    canDelete: boolean;
    onLaunch: (row: CreditRow) => void;
    onDelete: (row: CreditRow) => void;
    skeletonRowCount?: number;
}

/**
 * Credits list table. Columns: title, group, course/chapter, scheduled date,
 * status badge, attempt stats, last launch, row actions (open / launch / delete).
 */
export function CreditsTable({ rows, loading, canConduct, canDelete, onLaunch, onDelete, skeletonRowCount = 10 }: CreditsTableProps) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();

    const showActions = canConduct || canDelete;
    const columnCount = showActions ? 8 : 7;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_group')}</TableHead>
                    <TableHead>{t('col_course')}</TableHead>
                    <TableHead>{t('col_scheduled')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_stats')}</TableHead>
                    <TableHead>{t('col_last_launch')}</TableHead>
                    {showActions ? <TableHead className='w-12'>{t('row_actions')}</TableHead> : null}
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
                                  <Link href={`/${locale}/credits/${r.id}`} className='font-medium hover:underline'>
                                      {r.title}
                                  </Link>
                              </TableCell>
                              <TableCell className='text-sm'>{r.group?.name ?? '—'}</TableCell>
                              <TableCell>
                                  <div className='text-sm'>{r.course?.title ?? '—'}</div>
                                  <div className='text-muted-foreground text-xs'>{r.chapter?.title ?? '—'}</div>
                              </TableCell>
                              <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.scheduled_at, locale)}</TableCell>
                              <TableCell>
                                  <CreditStatusBadge status={r.status} />
                              </TableCell>
                              <TableCell>
                                  <div className='flex flex-wrap items-center gap-1.5 text-xs'>
                                      <Badge variant='success'>{t('stats_passed', { count: r.stats?.passed ?? 0 })}</Badge>
                                      <Badge variant='destructive'>{t('stats_failed', { count: r.stats?.failed ?? 0 })}</Badge>
                                      <Badge variant='muted'>{t('stats_pending', { count: r.stats?.pending ?? 0 })}</Badge>
                                  </div>
                              </TableCell>
                              <TableCell className='text-sm'>{formatUnixSecondsOrDash(r.last_launch_at, locale)}</TableCell>
                              {showActions ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon' aria-label={t('row_actions')}>
                                                  <MoreHorizontalIcon className='h-4 w-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/${locale}/credits/${r.id}`}>{t('view_detail')}</Link>
                                              </DropdownMenuItem>
                                              {canConduct ? (
                                                  <DropdownMenuItem disabled={r.status !== 'active'} onClick={() => onLaunch(r)}>
                                                      <PlayCircle className='mr-2 h-4 w-4' />
                                                      {t('launch')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                              {canDelete ? (
                                                  <DropdownMenuItem onClick={() => onDelete(r)} className='text-destructive'>
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
