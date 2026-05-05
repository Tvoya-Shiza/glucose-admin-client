'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { getSale } from '@/lib/sales/api';
import { formatUnixDate } from '@/lib/users/format';
import { RefundDialog } from '../components/refund-dialog';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

/**
 * PAY-02 / D-06 — sales detail page.
 *
 * Three stacked sections per CONTEXT D-06:
 *   1. Buyer block: id + full_name + email + mobile.
 *   2. Product block: type + product_label + amount + total_amount + tax +
 *      commission + discount + access_to_purchased_item + access_days.
 *   3. Payment trace block: KaspiPayment rows matched on
 *      Sale.buyer_id == KaspiPayment.account (best-effort, no FK constraint).
 *
 * Refund button (top-right): visible only when (a) the actor is admin AND
 * (b) sale.refund_at === null. After successful refund the detail query is
 * invalidated and the badge swaps to `detail_refund_status_refunded`.
 *
 * Admin-only refund button is UX polish — the real gate is admin-api's
 * @Roles('admin') on POST /sales/:id/refund. The /api/auth/me lookup mirrors
 * AdminNav's pattern and shares the `['auth.me']` query key for cache reuse.
 */
export function SaleDetailClient({ saleId }: { saleId: string }) {
    const t = useTranslations('admin.sales');
    const locale = useLocale() as 'ru' | 'kz';
    const [refundOpen, setRefundOpen] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.sales.detail', saleId] as const,
        queryFn: () => getSale(saleId),
    });

    const { data: me } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 60_000,
    });

    const isAdmin = me?.data?.role_name === 'admin';

    if (isLoading) {
        return (
            <div className='space-y-3 p-6'>
                <Skeleton className='h-10 w-1/3' />
                <Skeleton className='h-72 w-full' />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className='p-6'>
                <p className='text-destructive text-sm'>{(error as Error)?.message ?? 'error'}</p>
                <Link className='text-sm underline' href={`/${locale}/sales`}>
                    ← {t('list_title')}
                </Link>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-6 p-6'>
            <header className='flex items-center justify-between'>
                <div>
                    <Link className='text-sm underline mb-1 inline-block' href={`/${locale}/sales`}>
                        ← {t('list_title')}
                    </Link>
                    <h1 className='text-2xl font-semibold'>
                        {t('detail_title', { id: data.id })}
                    </h1>
                    <div className='mt-1 text-sm'>
                        {data.refund_at !== null ? (
                            <Badge variant='destructive'>
                                {t('detail_refund_status_refunded', {
                                    date: formatUnixDate(data.refund_at, locale),
                                })}
                            </Badge>
                        ) : (
                            <Badge>{t('detail_refund_status_active')}</Badge>
                        )}
                        {data.manual_added ? (
                            <Badge variant='outline' className='ml-2'>
                                {t('col_manual')}
                            </Badge>
                        ) : null}
                    </div>
                </div>

                {isAdmin && data.refund_at === null ? (
                    <Button onClick={() => setRefundOpen(true)}>{t('refund_button')}</Button>
                ) : null}
            </header>

            {/* Buyer block */}
            <section className='space-y-2'>
                <h2 className='text-lg font-semibold'>{t('detail_buyer_block')}</h2>
                <dl className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                    <DetailRow label='id' value={String(data.buyer.id)} />
                    <DetailRow label='full_name' value={data.buyer.full_name ?? '—'} />
                    <DetailRow label='email' value={data.buyer.email ?? '—'} />
                    <DetailRow label='mobile' value={data.buyer.mobile ?? '—'} />
                </dl>
            </section>

            {/* Product block */}
            <section className='space-y-2'>
                <h2 className='text-lg font-semibold'>{t('detail_product_block')}</h2>
                <dl className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                    <DetailRow label='type' value={data.type ?? '—'} />
                    <DetailRow label='product_label' value={data.product_label ?? '—'} />
                    <DetailRow label='amount' value={data.amount} />
                    <DetailRow label='total_amount' value={data.total_amount ?? '—'} />
                    <DetailRow label='tax' value={data.tax ?? '—'} />
                    <DetailRow label='commission' value={data.commission ?? '—'} />
                    <DetailRow label='discount' value={data.discount ?? '—'} />
                    <DetailRow label='payment_method' value={data.payment_method ?? '—'} />
                    <DetailRow
                        label='access_to_purchased_item'
                        value={data.access_to_purchased_item ? 'true' : 'false'}
                    />
                    <DetailRow
                        label='access_days'
                        value={data.access_days !== null ? String(data.access_days) : '—'}
                    />
                    <DetailRow label='created_at' value={formatUnixDate(data.created_at, locale)} />
                    <DetailRow
                        label='refund_at'
                        value={data.refund_at !== null ? formatUnixDate(data.refund_at, locale) : '—'}
                    />
                </dl>
            </section>

            {/* Payment trace block */}
            <section className='space-y-2'>
                <h2 className='text-lg font-semibold'>{t('detail_payment_block')}</h2>
                {data.payment_trace.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>{t('no_payment_trace')}</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>id</TableHead>
                                <TableHead>txn_id</TableHead>
                                <TableHead>txn_date</TableHead>
                                <TableHead className='text-right'>sum</TableHead>
                                <TableHead>status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.payment_trace.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className='font-mono text-xs'>{p.id}</TableCell>
                                    <TableCell className='font-mono text-xs'>{p.txn_id}</TableCell>
                                    <TableCell className='text-xs'>
                                        {formatUnixDate(p.txn_date, locale)}
                                    </TableCell>
                                    <TableCell className='text-right font-mono text-xs'>
                                        {p.sum}
                                    </TableCell>
                                    <TableCell className='text-xs'>
                                        {p.status === null ? '—' : p.status}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </section>

            <RefundDialog
                open={refundOpen}
                onOpenChange={setRefundOpen}
                sale={{
                    id: data.id,
                    amount: data.amount,
                    total_amount: data.total_amount,
                    refund_at: data.refund_at,
                }}
            />
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid grid-cols-[160px_1fr] items-baseline gap-2'>
            <dt className='text-muted-foreground text-xs uppercase tracking-wide'>{label}</dt>
            <dd className='break-all text-sm'>{value}</dd>
        </div>
    );
}
