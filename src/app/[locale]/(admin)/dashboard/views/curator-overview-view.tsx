'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCuratorOverview } from '@/lib/analytics/api';
import { SnapshotStaleness } from '../components/snapshot-staleness';
import { WindowPicker, WINDOWS, windowToQueryParams, type WindowValue } from '../components/window-picker';

/**
 * Phase 9 ANL-02 (D-11, D-14, D-17, D-19) — curator overview view.
 *
 * Reads ?window=1d|7d|30d|all from the URL (default 7d), maps to
 * window_days/window_all query params, calls /curator-overview, renders:
 *   - Table of supervised groups with member_count, active_members,
 *     avg_progress, completion_rate.
 *   - WindowPicker bound to nuqs.
 *   - Snapshot staleness banner.
 *
 * Admin pivot (D-19): when an admin pivots to curator view, the server still
 * scopes by actor.id (the admin's own id) — they see groups they personally
 * supervise. Empty list is the expected outcome unless the admin happens to be
 * a Group.supervisor_id elsewhere. Documented in T-09-04-03 + T-09-05-01.
 */
export function CuratorOverviewView() {
    const t = useTranslations('admin.dashboard');
    const [w] = useQueryState('window', parseAsStringLiteral(WINDOWS).withDefault('7d'));
    const params = windowToQueryParams(w as WindowValue);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['analytics.curator-overview', w],
        queryFn: () => getCuratorOverview(params),
        staleTime: 60_000,
    });

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <h2 className='text-xl font-semibold'>{t('curator_title')}</h2>
                <div className='flex flex-wrap items-center gap-3'>
                    <span className='text-muted-foreground text-sm'>{t('curator_window_label')}:</span>
                    <WindowPicker />
                    {data && <SnapshotStaleness snapshotAt={data.snapshot_at} />}
                </div>
            </div>

            {isLoading ? (
                <div className='space-y-2'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className='h-12' />
                    ))}
                </div>
            ) : isError || !data ? (
                <p className='text-destructive'>{t('load_failed')}</p>
            ) : data.groups.length === 0 ? (
                <p className='text-muted-foreground'>{t('curator_no_groups')}</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className='text-right'>Members</TableHead>
                            <TableHead className='text-right'>Active</TableHead>
                            <TableHead className='text-right'>Avg progress</TableHead>
                            <TableHead className='text-right'>Completion rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.groups.map((g) => (
                            <TableRow key={g.id}>
                                <TableCell>{g.id}</TableCell>
                                <TableCell>{g.name}</TableCell>
                                <TableCell className='text-right'>{g.member_count}</TableCell>
                                <TableCell className='text-right'>{g.active_members}</TableCell>
                                <TableCell className='text-right'>
                                    {g.avg_progress !== null
                                        ? `${(g.avg_progress * 100).toFixed(0)}%`
                                        : '—'}
                                </TableCell>
                                <TableCell className='text-right'>
                                    {g.completion_rate !== null
                                        ? `${(g.completion_rate * 100).toFixed(0)}%`
                                        : '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
