'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { formatUnixDate } from '@/lib/users/format';
import type { UserDetail } from '@/lib/users/types';

/**
 * USR-02 — read-only course-access summary.
 *
 * Renders from the same `course_access` array embedded in the detail payload — no
 * separate query (D-10). Manual-added rows wear an outline badge; refunded rows
 * wear a destructive badge.
 */
export function CoursesTab({ user }: { user: UserDetail }) {
    const t = useTranslations('admin.users');
    const locale = useLocale();

    if (user.course_access.length === 0) {
        return <p className='text-muted-foreground pt-4 text-sm'>{t('empty')}</p>;
    }

    return (
        <ul className='divide-y pt-4'>
            {user.course_access.map((c) => (
                <li key={c.sale_id} className='flex items-center justify-between py-2'>
                    <span>{c.webinar_name ?? `webinar #${c.webinar_id ?? '—'}`}</span>
                    <span className='text-muted-foreground flex items-center gap-2 text-xs'>
                        {c.manual_added ? <Badge variant='outline'>manual</Badge> : null}
                        <span>{formatUnixDate(c.created_at, locale)}</span>
                        {c.refund_at ? <Badge variant='destructive'>refunded</Badge> : null}
                    </span>
                </li>
            ))}
        </ul>
    );
}
