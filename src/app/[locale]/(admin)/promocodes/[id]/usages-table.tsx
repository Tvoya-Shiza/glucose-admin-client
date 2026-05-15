'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { EmptyState } from '@/components/users/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { listPromocodeUsages } from '@/lib/promocodes/api';

export interface UsagesTableProps {
    promocodeId: number;
}

function formatUnixSecondsOrDash(value: number | null | undefined, locale: string): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/**
 * PRM-02 — paginated usages table for a single promocode.
 *
 * URL state nested under the detail page: `usages_page`, `usages_order` (asc|desc).
 * Default sort: used_at desc.
 *
 * Decimal display: `discount_amount` and `order_amount` come from admin-api as
 * opaque strings (Plan 01 — Decimal-as-string posture). We render them as-is.
 */
export function UsagesTable({ promocodeId }: UsagesTableProps) {
    const t = useTranslations('admin.promocodes');
    const locale = useLocale();

    const [{ usages_page, usages_page_size, usages_order }, setQ] = useQueryStates({
        usages_page: parseAsInteger.withDefault(1),
        usages_page_size: parseAsInteger.withDefault(50),
        usages_order: parseAsString.withDefault('desc'),
    });

    const queryKey = useMemo(
        () =>
            [
                'admin.promocodes.usages',
                promocodeId,
                { page: usages_page, page_size: usages_page_size, order: usages_order },
            ] as const,
        [promocodeId, usages_page, usages_page_size, usages_order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listPromocodeUsages(promocodeId, {
                page: usages_page,
                page_size: usages_page_size,
                sort: 'used_at',
                order: (usages_order as 'asc' | 'desc') ?? 'desc',
            }),
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    if (error) {
        return <EmptyState title={t('error_generic')} subtitle={(error as Error).message} />;
    }
    if (!isLoading && rows.length === 0) {
        return <EmptyState title={t('usage_empty')} />;
    }

    return (
        <div className='flex flex-col'>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t('usage_col_user')}</TableHead>
                        <TableHead>{t('usage_col_order')}</TableHead>
                        <TableHead className='text-right'>{t('usage_col_discount')}</TableHead>
                        <TableHead className='text-right'>{t('usage_col_order_amount')}</TableHead>
                        <TableHead>{t('usage_col_used_at')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? Array.from({ length: 8 }).map((_, i) => (
                              <TableRow key={`uskel-${i}`}>
                                  <TableCell colSpan={6}>
                                      <Skeleton className='h-6 w-full' />
                                  </TableCell>
                              </TableRow>
                          ))
                        : rows.map((r) => (
                              <TableRow key={r.id}>
                                  <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                                  <TableCell>
                                      <div className='flex flex-col text-sm'>
                                          <span>{r.user_full_name ?? '—'}</span>
                                          <span className='text-xs text-muted-foreground'>
                                              {r.user_email ?? '—'}
                                          </span>
                                      </div>
                                  </TableCell>
                                  <TableCell className='font-mono text-xs'>#{r.order_id}</TableCell>
                                  <TableCell className='text-right tabular-nums'>
                                      {r.discount_amount ?? '—'}
                                  </TableCell>
                                  <TableCell className='text-right tabular-nums'>
                                      {r.order_amount ?? '—'}
                                  </TableCell>
                                  <TableCell className='text-sm'>
                                      {formatUnixSecondsOrDash(r.used_at, locale)}
                                  </TableCell>
                              </TableRow>
                          ))}
                </TableBody>
            </Table>

            <div className='flex items-center justify-between border-t p-4 text-sm'>
                <span className='text-muted-foreground'>
                    {isFetching ? t('loading') : `${total}`}
                </span>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={usages_page <= 1}
                        onClick={() => setQ({ usages_page: usages_page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='tabular-nums'>{usages_page}</span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={rows.length < usages_page_size}
                        onClick={() => setQ({ usages_page: usages_page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            </div>
        </div>
    );
}
