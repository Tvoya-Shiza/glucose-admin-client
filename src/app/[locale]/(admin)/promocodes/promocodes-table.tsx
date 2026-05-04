'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { DiscountType, PromocodeRow } from '@/lib/promocodes/types';

export interface PromocodesTableProps {
    rows: PromocodeRow[];
    loading: boolean;
    locale: 'ru' | 'kz';
    onEdit: (row: PromocodeRow) => void;
    onDelete: (row: PromocodeRow) => void;
    skeletonRowCount?: number;
}

function formatUnixSecondsOrDash(value: number | null | undefined, locale: 'ru' | 'kz'): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

function formatDiscount(type: DiscountType, value: string): string {
    if (type === 'percentage') return `${value}%`;
    return `${value} ₸`;
}

/**
 * Compute window status from server timestamps. Server is the source of truth
 * for filter `status_window`; here we just label the row consistently with
 * what the user sees in the filter chip.
 */
function windowStatus(now: number, start_date: number, expires_at: number, is_active: boolean): 'active' | 'expired' | 'future' | 'inactive' {
    if (!is_active) return 'inactive';
    if (now < start_date) return 'future';
    if (now > expires_at) return 'expired';
    return 'active';
}

function statusVariant(s: 'active' | 'expired' | 'future' | 'inactive'): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (s === 'active') return 'default';
    if (s === 'expired') return 'destructive';
    if (s === 'future') return 'secondary';
    return 'outline';
}

/**
 * PRM-01 — promocodes table.
 *
 * Columns: id, code (mono), title, discount_type (badge), discount_value
 * (formatted), status (computed window badge), usage_count / usage_limit,
 * start_date, expires_at, created_at, Actions (View detail + Edit + Delete).
 *
 * NO checkbox column — promocodes have no bulk-status flow (D-13/D-14).
 */
export function PromocodesTable({
    rows,
    loading,
    locale,
    onEdit,
    onDelete,
    skeletonRowCount = 10,
}: PromocodesTableProps) {
    const t = useTranslations('admin.promocodes');
    const now = Math.floor(Date.now() / 1000);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_id')}</TableHead>
                    <TableHead>{t('col_code')}</TableHead>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_discount_type')}</TableHead>
                    <TableHead className='text-right'>{t('col_discount_value')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead className='text-right'>{t('col_usage_count')}</TableHead>
                    <TableHead className='text-right'>{t('col_usage_limit')}</TableHead>
                    <TableHead>{t('col_start_date')}</TableHead>
                    <TableHead>{t('col_expires_at')}</TableHead>
                    <TableHead>{t('col_created_at')}</TableHead>
                    <TableHead className='w-12'>{t('actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={12}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => {
                          const ws = windowStatus(now, r.start_date, r.expires_at, r.is_active);
                          return (
                              <TableRow key={r.id}>
                                  <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                                  <TableCell>
                                      <Link
                                          href={`./promocodes/${r.id}`}
                                          className='font-mono text-xs underline-offset-2 hover:underline'
                                      >
                                          {r.code}
                                      </Link>
                                  </TableCell>
                                  <TableCell className='max-w-[260px] truncate' title={r.title ?? ''}>
                                      {r.title ?? '—'}
                                  </TableCell>
                                  <TableCell>
                                      <Badge variant={r.discount_type === 'percentage' ? 'default' : 'secondary'}>
                                          {t(`discount_type_${r.discount_type}`)}
                                      </Badge>
                                  </TableCell>
                                  <TableCell className='text-right tabular-nums'>
                                      {formatDiscount(r.discount_type, r.discount_value)}
                                  </TableCell>
                                  <TableCell>
                                      <Badge variant={statusVariant(ws)}>{t(`status_${ws}`)}</Badge>
                                  </TableCell>
                                  <TableCell className='text-right tabular-nums'>{r.usage_count}</TableCell>
                                  <TableCell className='text-right tabular-nums text-muted-foreground'>
                                      {r.usage_limit ?? '∞'}
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.start_date, locale)}
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.expires_at, locale)}
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.created_at, locale)}
                                  </TableCell>
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
                                                  <Link href={`./promocodes/${r.id}`}>
                                                      {t('view_detail')}
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => onEdit(r)}>
                                                  {t('edit')}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                  onClick={() => onDelete(r)}
                                                  className='text-destructive'
                                              >
                                                  {t('delete')}
                                              </DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </TableCell>
                              </TableRow>
                          );
                      })}
            </TableBody>
        </Table>
    );
}
