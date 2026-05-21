'use client';

import { useTranslations } from 'next-intl';

interface Props {
    rows: Array<{ role_name: string; count: number }>;
}

/**
 * Compact horizontal-bar breakdown of users by role. Reads cleaner than a pie/donut
 * for the typical 4-role set (admin/curator/teacher/student) and adds no chart deps.
 */
export function UsersRoleBreakdown({ rows }: Props) {
    const t = useTranslations('admin.users');
    const total = rows.reduce((acc, r) => acc + r.count, 0);
    if (total === 0) {
        return <p className='text-muted-foreground text-sm'>{t('empty_no_filters')}</p>;
    }

    return (
        <ul className='space-y-2'>
            {rows.map((r) => {
                const pct = total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0;
                return (
                    <li key={r.role_name} className='space-y-1'>
                        <div className='flex items-baseline justify-between text-xs'>
                            <span className='text-muted-foreground'>{roleLabel(r.role_name, t)}</span>
                            <span className='tabular-nums'>
                                {r.count.toLocaleString()} <span className='text-muted-foreground'>({pct}%)</span>
                            </span>
                        </div>
                        <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
                            <div
                                className='h-full rounded-full bg-primary/70'
                                style={{ width: `${Math.min(100, pct)}%` }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

function roleLabel(role: string, t: ReturnType<typeof useTranslations>): string {
    switch (role) {
        case 'admin':
            return t('role_admin');
        case 'curator':
            return t('role_curator');
        case 'teacher':
            return t('role_teacher');
        case 'student':
            return t('role_student');
        default:
            return role;
    }
}
