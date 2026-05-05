'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTeacherOverview } from '@/lib/analytics/api';
import { SnapshotStaleness } from '../components/snapshot-staleness';

/**
 * Phase 9 ANL-03 (D-11, D-14, D-19) — teacher overview view.
 *
 * Renders the actor's webinars (id, title, student_count, recent_results_7d)
 * and the pending grading queue (capped 50 — pending_assignments_total signals
 * truncation via a Badge).
 *
 * Admin pivot (D-19): when an admin pivots to teacher view, the server scopes
 * by actor.id — they see THEIR webinars only, not a pivoted teacher's.
 * Documented in T-09-04-03 + T-09-05-01.
 */
export function TeacherOverviewView() {
    const t = useTranslations('admin.dashboard');
    const locale = useLocale();
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;

    const { data, isLoading, isError } = useQuery({
        queryKey: ['analytics.teacher-overview'],
        queryFn: () => getTeacherOverview(),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className='space-y-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className='h-16' />
                ))}
            </div>
        );
    }
    if (isError || !data) {
        return <p className='text-destructive'>{t('load_failed')}</p>;
    }

    const dateFmt = new Intl.DateTimeFormat(intlLocale);

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between'>
                <h2 className='text-xl font-semibold'>{t('teacher_title')}</h2>
                <SnapshotStaleness snapshotAt={data.snapshot_at} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('teacher_title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {data.courses.length === 0 ? (
                        <p className='text-muted-foreground'>{t('teacher_no_courses')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead className='text-right'>Students</TableHead>
                                    <TableHead className='text-right'>Recent (7d)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.courses.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>{c.id}</TableCell>
                                        <TableCell>{c.title || '—'}</TableCell>
                                        <TableCell className='text-right'>{c.student_count}</TableCell>
                                        <TableCell className='text-right'>{c.recent_results_7d}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        {t('teacher_pending_assignments')}
                        {data.pending_assignments_total > data.pending_assignments.length && (
                            <Badge variant='secondary'>{data.pending_assignments_total}</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {data.pending_assignments.length === 0 ? (
                        <p className='text-muted-foreground'>{t('teacher_assignment_queue_empty')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Assignment</TableHead>
                                    <TableHead className='text-right'>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.pending_assignments.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell>{a.id}</TableCell>
                                        <TableCell>
                                            {a.student_full_name ?? `#${a.student_id}`}
                                        </TableCell>
                                        <TableCell>{a.assignment_id}</TableCell>
                                        <TableCell className='text-right'>
                                            {dateFmt.format(new Date(a.created_at * 1000))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
