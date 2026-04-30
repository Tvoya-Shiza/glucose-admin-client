'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatUnixDate } from '@/lib/users/format';
import type { UserDetail } from '@/lib/users/types';

/**
 * USR-02 — read-only recent-payments table.
 *
 * Renders from the `recent_payments` array embedded in the detail payload (limited
 * to 20 rows server-side); no separate query (D-10). Phase 9 (Payments / Refunds)
 * will extend this with full Sale + KaspiPayment cross-reference.
 */
export function PaymentsTab({ user }: { user: UserDetail }) {
    const t = useTranslations('admin.users');
    const locale = useLocale() as 'ru' | 'kz';

    if (user.recent_payments.length === 0) {
        return <p className='text-muted-foreground pt-4 text-sm'>{t('empty')}</p>;
    }

    return (
        <table className='w-full pt-4 text-sm'>
            <thead className='border-b'>
                <tr>
                    <th className='py-2 text-left'>id</th>
                    <th className='py-2 text-left'>amount</th>
                    <th className='py-2 text-left'>total</th>
                    <th className='py-2 text-left'>date</th>
                    <th className='py-2 text-left'>refund</th>
                </tr>
            </thead>
            <tbody>
                {user.recent_payments.map((p) => (
                    <tr key={p.id} className='border-b last:border-0'>
                        <td className='py-2 font-mono text-xs'>{p.id}</td>
                        <td className='py-2'>{p.amount}</td>
                        <td className='py-2'>{p.total_amount ?? '—'}</td>
                        <td className='py-2'>{formatUnixDate(p.created_at, locale)}</td>
                        <td className='py-2'>{p.refund_at ? formatUnixDate(p.refund_at, locale) : '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
