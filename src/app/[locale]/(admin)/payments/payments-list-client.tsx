'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listPayments } from '@/lib/payments/api';
import { formatUnixDate } from '@/lib/users/format';
import { PaymentDetailDrawer } from './components/payment-detail-drawer';
import { PaymentsExportButton } from './components/payments-export-button';

/**
 * PAY-01 — TanStack-Query-driven payments list page with nuqs URL state.
 *
 * URL state keys (D-01): page, page_size, status, date_from, date_to, amount_min,
 * amount_max, q, sort, order. URL survives reload + is shareable. Filter changes
 * reset page=1; sort changes do not.
 *
 * Filter fields:
 *   - q: text input, 300ms debounce (D-01). Server parses digits-only into
 *     account / txn_id matches.
 *   - status: numeric input (KaspiPayment.status is `Int?` — no enum).
 *   - date_from / date_to: numeric inputs accepting Unix seconds. Phase 9 v1
 *     keeps the raw-int input; date-picker integration is a follow-up.
 *   - amount_min / amount_max: numeric strings (Decimal-on-wire).
 *
 * Detail drawer (D-04): row click sets selected payment id; <PaymentDetailDrawer>
 * fetches lazily via getPayment + renders raw data1..10 + related sales.
 *
 * Export (D-09 / PAY-04): <PaymentsExportButton> mounted in the header passes the
 * current filter snapshot; admin-api applies @Throttle 5/15min/IP.
 */
export function PaymentsListClient() {
    const t = useTranslations('admin.payments');
    const locale = useLocale();

    const [{ page, page_size, status, date_from, date_to, amount_min, amount_max, q, sort, order }, setQ] =
        useQueryStates({
            page: parseAsInteger.withDefault(1),
            page_size: parseAsInteger.withDefault(50),
            status: parseAsInteger,
            date_from: parseAsInteger,
            date_to: parseAsInteger,
            amount_min: parseAsString,
            amount_max: parseAsString,
            q: parseAsString,
            sort: parseAsString.withDefault('txn_date'),
            order: parseAsString.withDefault('desc'),
        });

    // Local debounced search (D-01).
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
            status: status ?? undefined,
            date_from: date_from ?? undefined,
            date_to: date_to ?? undefined,
            amount_min: amount_min ?? undefined,
            amount_max: amount_max ?? undefined,
            q: q ?? undefined,
            sort: sort as 'txn_date' | 'id' | 'sum',
            order: order as 'asc' | 'desc',
        }),
        [status, date_from, date_to, amount_min, amount_max, q, sort, order],
    );

    const queryKey = useMemo(
        () =>
            [
                'admin.payments.list',
                { page, page_size, ...filterSnapshot },
            ] as const,
        [page, page_size, filterSnapshot],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () => listPayments({ page, page_size, ...filterSnapshot }),
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;

    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('list_title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('list_subtitle')}</p>
                </div>
                <PaymentsExportButton filters={filterSnapshot} />
            </header>

            <div className='flex flex-wrap items-center gap-3 border-b p-4'>
                <Input
                    className='max-w-sm'
                    placeholder={t('search_placeholder')}
                    value={qLocal}
                    onChange={(e) => setQLocal(e.target.value)}
                />
                <Input
                    className='w-32'
                    placeholder={t('filter_status')}
                    type='number'
                    value={status ?? ''}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setQ({ page: 1, status: v === '' ? null : Number(v) });
                    }}
                />
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
                <Input
                    className='w-32'
                    placeholder={t('filter_amount_min')}
                    value={amount_min ?? ''}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setQ({ page: 1, amount_min: v === '' ? null : v });
                    }}
                />
                <Input
                    className='w-32'
                    placeholder={t('filter_amount_max')}
                    value={amount_max ?? ''}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setQ({ page: 1, amount_max: v === '' ? null : v });
                    }}
                />
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
                                <TableHead>{t('col_txn_id')}</TableHead>
                                <TableHead>{t('col_account')}</TableHead>
                                <TableHead className='text-right'>{t('col_sum')}</TableHead>
                                <TableHead>{t('col_status')}</TableHead>
                                <TableHead>{t('col_txn_date')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 10 }).map((_, i) => (
                                      <TableRow key={`sk-${i}`}>
                                          <TableCell colSpan={6}>
                                              <Skeleton className='h-6 w-full' />
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : rows.map((r) => (
                                      <TableRow
                                          key={r.id}
                                          className='hover:bg-muted/50 cursor-pointer'
                                          onClick={() => setSelectedId(r.id)}
                                      >
                                          <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                                          <TableCell className='font-mono text-xs'>{r.txn_id}</TableCell>
                                          <TableCell className='font-mono text-xs'>{r.account}</TableCell>
                                          <TableCell className='text-right font-mono text-xs'>
                                              {r.sum}
                                          </TableCell>
                                          <TableCell className='text-xs'>
                                              {r.status === null ? '—' : r.status}
                                          </TableCell>
                                          <TableCell className='text-sm'>
                                              {formatUnixDate(r.txn_date, locale)}
                                          </TableCell>
                                      </TableRow>
                                  ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <footer className='flex items-center justify-between border-t p-4 text-sm'>
                <span className='text-muted-foreground'>
                    {isFetching ? '…' : `${total}`}
                </span>
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

            <PaymentDetailDrawer
                paymentId={selectedId}
                open={selectedId !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedId(null);
                }}
            />
        </div>
    );
}
