'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchUserQuizzes } from '@/lib/users/api';
import { formatUnixDate } from '@/lib/users/format';

/**
 * "Tests" tab — quiz access (Sale grants) + result history (QuizResult).
 *
 * Lazy-loaded by UserDetailClient on tab activation. Query key isolates the dataset
 * so toggling tabs doesn't re-fire the lighter detail query.
 */
export function TestsTab({ userId }: { userId: number }) {
    const t = useTranslations('admin.users');
    const locale = useLocale();

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.users.quizzes', userId],
        queryFn: () => fetchUserQuizzes(userId),
    });

    if (isLoading) {
        return (
            <div className='space-y-3 pt-4'>
                <Skeleton className='h-32 w-full' />
                <Skeleton className='h-32 w-full' />
            </div>
        );
    }
    if (error) {
        return <p className='pt-4 text-sm text-destructive'>{(error as Error).message ?? t('error_generic')}</p>;
    }

    const access = data?.access ?? [];
    const results = data?.results ?? [];

    return (
        <div className='space-y-6 pt-4'>
            <section>
                <h3 className='mb-2 text-sm font-medium'>{t('tests_access_title')}</h3>
                {access.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>{t('tests_access_empty')}</p>
                ) : (
                    <ul className='divide-y'>
                        {access.map((a) => (
                            <li key={a.sale_id} className='flex items-center justify-between gap-3 py-2 text-sm'>
                                <span className='truncate'>
                                    {a.quiz_name ??
                                        (a.kind === 'quiz_badge'
                                            ? `badge #${a.quiz_badge_id ?? '—'}`
                                            : `quiz #${a.quiz_id ?? '—'}`)}
                                </span>
                                <span className='text-muted-foreground flex items-center gap-2 text-xs'>
                                    <Badge variant='secondary'>
                                        {t(a.kind === 'quiz_badge' ? 'tests_kind_badge' : 'tests_kind_quiz')}
                                    </Badge>
                                    {a.manual_added ? <Badge variant='outline'>{t('tests_manual_added')}</Badge> : null}
                                    <span>{formatUnixDate(a.created_at, locale)}</span>
                                    {a.refund_at ? <Badge variant='destructive'>refunded</Badge> : null}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h3 className='mb-2 text-sm font-medium'>{t('tests_results_title')}</h3>
                {results.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>{t('tests_results_empty')}</p>
                ) : (
                    <ul className='divide-y'>
                        {results.map((r) => (
                            <li key={r.id} className='flex items-center justify-between gap-3 py-2 text-sm'>
                                <span className='truncate'>{r.quiz_name ?? `quiz #${r.quiz_id}`}</span>
                                <span className='text-muted-foreground flex items-center gap-2 text-xs'>
                                    <Badge variant={statusBadgeVariant(r.status)}>
                                        {t(
                                            r.status === 'passed'
                                                ? 'tests_status_passed'
                                                : r.status === 'failed'
                                                    ? 'tests_status_failed'
                                                    : 'tests_status_waiting',
                                        )}
                                    </Badge>
                                    {typeof r.user_grade === 'number' ? (
                                        <span className='tabular-nums'>{r.user_grade}</span>
                                    ) : null}
                                    <span>{formatUnixDate(r.created_at, locale)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function statusBadgeVariant(status: 'waiting' | 'passed' | 'failed'): 'default' | 'destructive' | 'secondary' {
    if (status === 'passed') return 'default';
    if (status === 'failed') return 'destructive';
    return 'secondary';
}
