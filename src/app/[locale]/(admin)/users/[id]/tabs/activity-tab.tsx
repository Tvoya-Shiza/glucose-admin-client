'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserActivity } from '@/lib/users/api';

/**
 * USR-02 — paginated audit-log feed for this user (D-10).
 *
 * Lazy-mounted by UserDetailClient — the query never fires until the user clicks the
 * Activity tab. Empty result is the expected state in early days because AdminAuditLog
 * may not have rows yet (NDJSON-only); admin-api falls back to {rows:[]} gracefully.
 *
 * Phase 3 ships a flat list; Phase 9 may add filters, paging UI, and bulk_op_id grouping.
 */
export function ActivityTab({ userId }: { userId: number }) {
    const t = useTranslations('admin.users');
    const { data, isLoading } = useQuery({
        queryKey: ['admin.users.activity', userId],
        queryFn: () => getUserActivity(userId, 1, 50),
    });

    if (isLoading) return <Skeleton className='h-72 w-full' />;
    const rows = data?.rows ?? [];
    if (rows.length === 0) return <p className='text-muted-foreground pt-4 text-sm'>{t('empty')}</p>;

    return (
        <ul className='divide-y pt-4 text-sm'>
            {rows.map((r) => (
                <li key={r.id} className='flex justify-between py-2'>
                    <code className='text-xs'>{r.action}</code>
                    <span className='text-muted-foreground text-xs'>
                        actor:{r.actor_id ?? '—'} · ts:{r.ts}
                    </span>
                </li>
            ))}
        </ul>
    );
}
