'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { listSales } from '@/lib/sales/api';
import type { PaymentMethodLit, SaleSortField, SaleSortOrder, SaleTypeLit } from '@/lib/sales/types';
import { formatUnixDate } from '@/lib/users/format';
import { SalesExportButton } from './components/sales-export-button';

const TYPE_OPTIONS: SaleTypeLit[] = ['webinar', 'quiz', 'quiz_badge'];
const PAYMENT_METHOD_OPTIONS: PaymentMethodLit[] = ['credit', 'payment_channel', 'subscribe', 'group_access'];

/**
 * PAY-02 — TanStack-Query-driven sales list page with nuqs URL state.
 *
 * URL state keys (D-01 / D-05): page, page_size, type, payment_method,
 * only_refunded, only_manual, date_from, date_to, q, sort, order. URL survives
 * reload + is shareable. Filter changes reset page=1; sort changes do not.
 *
 * Filter fields:
 *   - q: text input, 300ms debounce. Server searches buyer.full_name | email | mobile
 *     (mobile auto-normalized via normalizeKzPhone).
 *   - type: 3-option Select (webinar | quiz | quiz_badge).
 *   - payment_method: 4-option Select (credit | payment_channel | subscribe | group_access).
 *   - only_refunded / only_manual: Checkbox toggles.
 *   - date_from / date_to: numeric inputs accepting Unix seconds. Phase 9 v1
 *     keeps the raw-int input; date-picker integration is a follow-up.
 *
 * Detail navigation (D-06): row click routes to `/[locale]/sales/[id]` (separate
 * page, NOT a drawer — Sales detail is heavier than Payments detail and benefits
 * from full-page real estate for the buyer + product + payment-trace blocks).
 *
 * Export (D-09): <SalesExportButton> mounted in the header passes the current
 * filter snapshot; admin-api applies @Throttle 5/15min/IP.
 */
export function SalesListClient() {
    const t = useTranslations('admin.sales');
    const locale = useLocale();
    const router = useRouter();

    const [
        {
            page,
            page_size,
            type,
            payment_method,
            only_refunded,
            only_manual,
            date_from,
            date_to,
            q,
            sort,
            order,
        },
        setQ,
    ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        type: parseAsString,
        payment_method: parseAsString,
        only_refunded: parseAsString,
        only_manual: parseAsString,
        date_from: parseAsInteger,
        date_to: parseAsInteger,
        q: parseAsString,
        sort: parseAsString.withDefault('created_at'),
        order: parseAsString.withDefault('desc'),
    });

    // Local debounced search.
    const [qLocal, setQLocal] = useState(q ?? '');
    useEffect(() => {
        const id = setTimeout(() => {
            if ((q ?? '') !== qLocal) {
                setQ({ page: 1, q: qLocal || null });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    const filterSnapshot = useMemo(
        () => ({
            type: (type as SaleTypeLit | null) ?? undefined,
            payment_method: (payment_method as PaymentMethodLit | null) ?? undefined,
            only_refunded: only_refunded === '1' ? true : undefined,
            only_manual: only_manual === '1' ? true : undefined,
            date_from: date_from ?? undefined,
            date_to: date_to ?? undefined,
            q: q ?? undefined,
            sort: sort as SaleSortField,
            order: order as SaleSortOrder,
        }),
        [type, payment_method, only_refunded, only_manual, date_from, date_to, q, sort, order],
    );

    const queryKey = useMemo(
        () => ['admin.sales.list', { page, page_size, ...filterSnapshot }] as const,
        [page, page_size, filterSnapshot],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () => listSales({ page, page_size, ...filterSnapshot }),
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    const goDetail = (id: number) => router.push(`/${locale}/sales/${id}`);

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('list_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('list_subtitle')}</p>
                </div>
                <SalesExportButton filters={filterSnapshot} />
            </header>

            <div className='flex flex-wrap items-center gap-3 border-b p-4'>
                <Input
                    className='max-w-sm'
                    placeholder={t('search_placeholder')}
                    value={qLocal}
                    onChange={(e) => setQLocal(e.target.value)}
                />

                <Select
                    value={type ?? '_all'}
                    onValueChange={(v) => setQ({ page: 1, type: v === '_all' ? null : v })}
                >
                    <SelectTrigger className='w-44'>
                        <SelectValue placeholder={t('filter_status')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='_all'>{t('filter_status')}</SelectItem>
                        {TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={payment_method ?? '_all'}
                    onValueChange={(v) => setQ({ page: 1, payment_method: v === '_all' ? null : v })}
                >
                    <SelectTrigger className='w-48'>
                        <SelectValue placeholder={t('filter_payment_method')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='_all'>{t('filter_payment_method')}</SelectItem>
                        {PAYMENT_METHOD_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    className='w-44'
                    placeholder={t('filter_date_from')}
                    type='number'
                    value={date_from ?? ''}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setQ({ page: 1, date_from: v === '' ? null : Number(v) });
                    }}
                />
                <Input
                    className='w-44'
                    placeholder={t('filter_date_to')}
                    type='number'
                    value={date_to ?? ''}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setQ({ page: 1, date_to: v === '' ? null : Number(v) });
                    }}
                />

                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={only_refunded === '1'}
                        onCheckedChange={(c) =>
                            setQ({ page: 1, only_refunded: c === true ? '1' : null })
                        }
                    />
                    {t('filter_only_refunded')}
                </label>
                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={only_manual === '1'}
                        onCheckedChange={(c) =>
                            setQ({ page: 1, only_manual: c === true ? '1' : null })
                        }
                    />
                    {t('filter_only_manual')}
                </label>
            </div>

            <div className='flex-1 overflow-auto'>
                {error ? (
                    <div className='text-destructive p-6 text-sm'>{(error as Error).message}</div>
                ) : !isLoading && rows.length === 0 ? (
                    <div className='text-muted-foreground p-6 text-sm'>{t('no_results')}</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('col_id')}</TableHead>
                                <TableHead>{t('col_buyer')}</TableHead>
                                <TableHead>{t('col_product')}</TableHead>
                                <TableHead className='text-right'>{t('col_amount')}</TableHead>
                                <TableHead className='text-right'>{t('col_total_amount')}</TableHead>
                                <TableHead>{t('col_payment_method')}</TableHead>
                                <TableHead>{t('col_created_at')}</TableHead>
                                <TableHead>{t('col_refund_at')}</TableHead>
                                <TableHead>{t('col_manual')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 10 }).map((_, i) => (
                                      <TableRow key={`sk-${i}`}>
                                          <TableCell colSpan={9}>
                                              <Skeleton className='h-6 w-full' />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((r) => (
                                      <TableRow
                                          key={r.id}
                                          className='hover:bg-muted/50 cursor-pointer'
                                          onClick={() => goDetail(r.id)}
                                      >
                                          <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                                          <TableCell className='text-xs'>
                                              <div>{r.buyer.full_name ?? '—'}</div>
                                              <div className='text-muted-foreground'>
                                                  {r.buyer.email ?? r.buyer.mobile ?? '—'}
                                              </div>
                                          </TableCell>
                                          <TableCell className='text-xs'>
                                              {r.product_label ?? r.type ?? '—'}
                                          </TableCell>
                                          <TableCell className='text-right font-mono text-xs'>
                                              {r.amount}
                                          </TableCell>
                                          <TableCell className='text-right font-mono text-xs'>
                                              {r.total_amount ?? '—'}
                                          </TableCell>
                                          <TableCell className='text-xs'>
                                              {r.payment_method ?? '—'}
                                          </TableCell>
                                          <TableCell className='text-sm'>
                                              {formatUnixDate(r.created_at, locale)}
                                          </TableCell>
                                          <TableCell className='text-sm'>
                                              {r.refund_at !== null
                                                  ? formatUnixDate(r.refund_at, locale)
                                                  : t('detail_refund_status_active')}
                                          </TableCell>
                                          <TableCell className='text-xs'>
                                              {r.manual_added ? '✓' : ''}
                                          </TableCell>
                                      </TableRow>
                                  ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <footer className='flex items-center justify-between border-t p-4 text-sm'>
                <span className='text-muted-foreground'>{isFetching ? '…' : `${total}`}</span>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => setQ({ page: page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='tabular-nums'>{page}</span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={rows.length < page_size}
                        onClick={() => setQ({ page: page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            </footer>
        </div>
    );
}
