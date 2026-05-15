'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getPayment } from '@/lib/payments/api';
import { formatUnixDate } from '@/lib/users/format';

export interface PaymentDetailDrawerProps {
    paymentId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * PAY-01 / D-04 — payment detail drawer.
 *
 * shadcn `<Sheet>` renders a side drawer; opens when `paymentId !== null`.
 * Three sections:
 *   1. Top: id, txn_id, account, sum, status, txn_date — formatted block.
 *   2. Middle: raw Kaspi data1..data10 (skip null/empty values).
 *   3. Bottom: related Sale rows (id, webinar_id, created_at, total_amount).
 *
 * Fetches via `getPayment(id)` only when paymentId is non-null AND drawer is open
 * (TanStack Query `enabled` guard). Errors surface inline rather than as toasts —
 * this is a read-only drawer, no retry path.
 */
export function PaymentDetailDrawer({ paymentId, open, onOpenChange }: PaymentDetailDrawerProps) {
    const t = useTranslations('admin.payments');
    const locale = useLocale();

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.payments.detail', paymentId] as const,
        queryFn: () => getPayment(paymentId as number),
        enabled: open && paymentId !== null,
    });

    const dataN: Array<[string, string | null]> = data
        ? [
              ['data1', data.data1],
              ['data2', data.data2],
              ['data3', data.data3],
              ['data4', data.data4],
              ['data5', data.data5],
              ['data6', data.data6],
              ['data7', data.data7],
              ['data8', data.data8],
              ['data9', data.data9],
              ['data10', data.data10],
          ]
        : [];

    const nonEmptyData = dataN.filter(([, v]) => v !== null && v !== '');

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className='w-full overflow-y-auto sm:max-w-xl'>
                <SheetHeader>
                    <SheetTitle>
                        {paymentId !== null
                            ? t('detail_title', { id: paymentId })
                            : t('detail_title', { id: '' })}
                    </SheetTitle>
                    <SheetDescription>{t('list_subtitle')}</SheetDescription>
                </SheetHeader>

                <div className='space-y-6 px-4 pb-6'>
                    {error ? (
                        <div className='text-destructive text-sm'>{(error as Error).message}</div>
                    ) : isLoading || !data ? (
                        <div className='space-y-3'>
                            <Skeleton className='h-6 w-3/4' />
                            <Skeleton className='h-6 w-1/2' />
                            <Skeleton className='h-32 w-full' />
                        </div>
                    ) : (
                        <>
                            <section className='space-y-2'>
                                <DetailRow label={t('col_id')} value={String(data.id)} />
                                <DetailRow label={t('col_txn_id')} value={data.txn_id} />
                                <DetailRow label={t('col_account')} value={String(data.account)} />
                                <DetailRow label={t('col_sum')} value={data.sum} />
                                <DetailRow
                                    label={t('col_status')}
                                    value={data.status === null ? '—' : String(data.status)}
                                />
                                <DetailRow
                                    label={t('col_txn_date')}
                                    value={formatUnixDate(data.txn_date, locale)}
                                />
                            </section>

                            <section className='space-y-2'>
                                <h3 className='text-sm font-semibold'>{t('detail_raw_response')}</h3>
                                {nonEmptyData.length === 0 ? (
                                    <p className='text-muted-foreground text-sm'>—</p>
                                ) : (
                                    <dl className='space-y-1 text-sm'>
                                        {nonEmptyData.map(([k, v]) => (
                                            <div
                                                key={k}
                                                className='grid grid-cols-[100px_1fr] gap-2'
                                            >
                                                <dt className='text-muted-foreground font-mono text-xs'>
                                                    {k}
                                                </dt>
                                                <dd className='break-all text-xs'>{v}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </section>

                            <section className='space-y-2'>
                                <h3 className='text-sm font-semibold'>
                                    {t('detail_related_sales')}
                                </h3>
                                {data.related_sales.length === 0 ? (
                                    <p className='text-muted-foreground text-sm'>—</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>id</TableHead>
                                                <TableHead>webinar</TableHead>
                                                <TableHead>created</TableHead>
                                                <TableHead className='text-right'>amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.related_sales.map((s) => (
                                                <TableRow key={s.id}>
                                                    <TableCell className='font-mono text-xs'>
                                                        {s.id}
                                                    </TableCell>
                                                    <TableCell className='font-mono text-xs'>
                                                        {s.webinar_id ?? '—'}
                                                    </TableCell>
                                                    <TableCell className='text-xs'>
                                                        {formatUnixDate(s.created_at, locale)}
                                                    </TableCell>
                                                    <TableCell className='text-right font-mono text-xs'>
                                                        {s.total_amount ?? '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid grid-cols-[140px_1fr] items-baseline gap-2'>
            <dt className='text-muted-foreground text-xs uppercase tracking-wide'>{label}</dt>
            <dd className='break-all text-sm'>{value}</dd>
        </div>
    );
}
