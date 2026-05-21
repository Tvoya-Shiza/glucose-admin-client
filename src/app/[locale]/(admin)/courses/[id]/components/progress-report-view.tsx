'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getProgressReport } from '@/lib/courses-progress/api';
import { formatScheduleDate } from '@/lib/schedules/format';
import type { ProgressItem, ProgressUserStatusKind } from '@/lib/courses-progress/types';
import { ProgressTargetPicker, type ProgressTarget } from './progress-target-picker';

export interface ProgressReportViewProps {
    courseId: number;
}

/**
 * Phase 19 / Feature B2 — read-only progress report.
 *
 * Pick a user OR a group → render the course chapter tree with per-item:
 *   - user target  → status badge + score/grade + last_at
 *   - group target → "X / N" + ratio bar
 *
 * Top-of-tab summary: aggregate done/total/percent + last_activity.
 */
export function ProgressReportView({ courseId }: ProgressReportViewProps) {
    const t = useTranslations('admin.progress_overrides');
    const locale = useLocale();
    const [target, setTarget] = useState<ProgressTarget>({ kind: 'user', target_id: null });

    const targetReady = target.target_id !== null;

    const report = useQuery({
        queryKey: ['admin.courses-progress', courseId, target.kind, target.target_id],
        queryFn: () =>
            getProgressReport(courseId, {
                target_kind: target.kind,
                target_id: target.target_id as number,
            }),
        enabled: targetReady,
        staleTime: 30_000,
    });

    return (
        <div className='space-y-4'>
            <div className='rounded border bg-card p-3'>
                <p className='mb-3 text-sm font-medium'>{t('view_target_label')}</p>
                <ProgressTargetPicker value={target} onChange={setTarget} />
            </div>

            {!targetReady ? (
                <p className='text-sm text-muted-foreground'>{t('view_pick_target_hint')}</p>
            ) : report.isLoading ? (
                <Skeleton className='h-72 w-full' />
            ) : report.error ? (
                <p className='text-sm text-destructive'>{(report.error as Error).message}</p>
            ) : report.data ? (
                <>
                    <SummaryRow data={report.data} locale={locale} />
                    <div className='space-y-3'>
                        {report.data.chapters.map((chapter) => (
                            <Card key={chapter.id}>
                                <CardHeader className='pb-2'>
                                    <CardTitle className='text-sm font-medium'>{chapter.title}</CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-2'>
                                    {chapter.items.length === 0 ? (
                                        <p className='text-xs text-muted-foreground'>{t('chapter_empty')}</p>
                                    ) : (
                                        <ul className='divide-y'>
                                            {chapter.items.map((item) => (
                                                <li
                                                    key={item.id}
                                                    className='flex items-center gap-3 py-2'
                                                >
                                                    <span className='text-xs uppercase text-muted-foreground w-20'>
                                                        {item.type}
                                                    </span>
                                                    <span className='flex-1 truncate text-sm'>
                                                        {item.title}
                                                        {!item.is_required ? (
                                                            <span className='ml-2 text-xs text-muted-foreground'>
                                                                ({t('not_required')})
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <ItemStatus item={item} locale={locale} />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function SummaryRow({
    data,
    locale,
}: {
    data: import('@/lib/courses-progress/types').ProgressReport;
    locale: string;
}) {
    const t = useTranslations('admin.progress_overrides');
    const pct = Math.round(data.aggregate.percent * 100);
    return (
        <Card>
            <CardContent className='flex flex-wrap items-center gap-4 py-3 text-sm'>
                <span>
                    <strong>{data.target.label ?? '—'}</strong>
                    {data.target.kind === 'group' && data.target.members_count !== null ? (
                        <span className='ml-2 text-xs text-muted-foreground'>
                            · {t('members_count', { count: data.target.members_count })}
                        </span>
                    ) : null}
                </span>
                <span className='text-muted-foreground'>·</span>
                <span>
                    {t('progress_label')}: {data.aggregate.done} / {data.aggregate.total} ({pct}%)
                </span>
                <span className='text-muted-foreground'>·</span>
                <span>
                    {t('last_activity_label')}:{' '}
                    {data.last_activity == null ? '—' : formatScheduleDate(data.last_activity, locale)}
                </span>
            </CardContent>
        </Card>
    );
}

function ItemStatus({ item, locale }: { item: ProgressItem; locale: string }) {
    const t = useTranslations('admin.progress_overrides');
    if (item.user_status) {
        const s = item.user_status;
        return (
            <div className='flex items-center gap-2'>
                <StatusBadge kind={s.status} />
                {s.score !== null ? (
                    <span className='text-xs font-mono'>
                        {t('score_label')}: {s.score}
                    </span>
                ) : null}
                {s.grade !== null ? (
                    <span className='text-xs font-mono'>
                        {t('grade_label')}: {s.grade}
                    </span>
                ) : null}
                {s.attempts !== null && s.attempts > 1 ? (
                    <span className='text-xs text-muted-foreground'>×{s.attempts}</span>
                ) : null}
                {s.last_at !== null ? (
                    <span className='text-xs text-muted-foreground'>
                        {formatScheduleDate(s.last_at, locale)}
                    </span>
                ) : null}
            </div>
        );
    }
    if (item.group_completion) {
        const c = item.group_completion;
        const pct = Math.round(c.ratio * 100);
        return (
            <div className='flex items-center gap-2'>
                <span className='text-sm font-mono'>
                    {c.done} / {c.total}
                </span>
                <div className='h-2 w-24 overflow-hidden rounded bg-muted'>
                    <div
                        className='h-full bg-primary'
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className='text-xs text-muted-foreground w-10 text-right'>{pct}%</span>
            </div>
        );
    }
    return <span className='text-xs text-muted-foreground'>—</span>;
}

const STATUS_VARIANT: Record<ProgressUserStatusKind, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    passed: 'default',
    viewed: 'default',
    failed: 'destructive',
    pending: 'secondary',
    not_started: 'outline',
    not_submitted: 'outline',
};

function StatusBadge({ kind }: { kind: ProgressUserStatusKind }) {
    const t = useTranslations('admin.progress_overrides');
    return <Badge variant={STATUS_VARIANT[kind]}>{t(`status_${kind}`)}</Badge>;
}
