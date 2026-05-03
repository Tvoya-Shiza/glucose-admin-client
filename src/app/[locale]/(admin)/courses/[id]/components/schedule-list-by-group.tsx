'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteSchedule, listSchedules } from '@/lib/courses/api';
import type { ScheduleRow } from '@/lib/courses/types';
import { ScheduleRowForm } from './schedule-row-form';

/**
 * ScheduleListByGroup — Plan 06.
 *
 * Renders WebinarChapterSchedule rows for one (courseId, groupId) pair, grouped
 * by chapter (using the joined chapter title from the server response). Each row
 * shows item-id + type badge + start/end timestamps + the two flag badges + edit
 * + delete buttons.
 *
 * Mutations (delete / upsert) invalidate ['admin.courses.schedules', courseId, groupId]
 * AND ['admin.courses.detail', courseId] so the schedule_count badge in the
 * detail header refreshes too.
 *
 * Empty state surfaces `no_schedules_yet` with the Add button still visible.
 *
 * The plan's UX explicitly chooses native window.confirm for delete (mirrors the
 * Plan 05 chapter-row pattern) — single-row deletes don't need cascade preview.
 */

function fmtUnix(unix: number): string {
    if (typeof unix !== 'number' || unix <= 0) return '—';
    const d = new Date(unix * 1000);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ChapterGroup {
    chapterId: number | null;
    label: string;
    rows: ScheduleRow[];
}

function groupByChapter(rows: ScheduleRow[]): ChapterGroup[] {
    const map = new Map<number | null, ChapterGroup>();
    for (const r of rows) {
        const cid = r.chapter ? r.chapter.id : null;
        if (!map.has(cid)) {
            const ru = r.chapter?.translations.find((tr) => tr.locale === 'ru')?.title;
            const label = ru && ru.length > 0 ? ru : cid != null ? `#${cid}` : '—';
            map.set(cid, { chapterId: cid, label, rows: [] });
        }
        map.get(cid)!.rows.push(r);
    }
    // Stable order: by chapter.order asc, then by id.
    return Array.from(map.values()).sort((a, b) => {
        const oa = a.rows[0]?.chapter?.order ?? Number.MAX_SAFE_INTEGER;
        const ob = b.rows[0]?.chapter?.order ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return (a.chapterId ?? -1) - (b.chapterId ?? -1);
    });
}

export function ScheduleListByGroup({
    courseId,
    groupId,
}: {
    courseId: number;
    groupId: number;
}) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.courses.schedules', courseId, groupId],
        queryFn: () => listSchedules(courseId, { group_id: groupId }),
        retry: false,
    });

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<ScheduleRow | null>(null);

    const deleteMutation = useMutation({
        mutationFn: (scheduleId: string) => deleteSchedule(courseId, scheduleId),
        onSuccess: () => {
            toast.success(t('schedule_deleted'));
            qc.invalidateQueries({ queryKey: ['admin.courses.schedules', courseId, groupId] });
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
        },
        onError: (err: Error) => toast.error(err.message || t('generic_error')),
    });

    const handleDelete = (id: string) => {
        if (typeof window !== 'undefined' && !window.confirm(t('delete_schedule_confirm'))) {
            return;
        }
        deleteMutation.mutate(id);
    };

    const grouped = useMemo<ChapterGroup[]>(() => {
        if (!data?.rows) return [];
        return groupByChapter(data.rows);
    }, [data]);

    if (isLoading) {
        return (
            <div className='space-y-2 pt-2'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-32 w-full' />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant='destructive'>
                <AlertTitle>{t('schedule_loading_failed')}</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>
                    {data?.rows?.length ?? 0} {t('schedule_tab')}
                </span>
                <Button type='button' size='sm' onClick={() => setCreateOpen(true)}>
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_schedule')}
                </Button>
            </div>

            {grouped.length === 0 ? (
                <Alert>
                    <AlertTitle>{t('no_schedules_yet')}</AlertTitle>
                </Alert>
            ) : (
                <div className='space-y-4'>
                    {grouped.map((g) => (
                        <div key={g.chapterId ?? 'orphans'} className='bg-card rounded-lg border'>
                            <div className='border-b px-3 py-2 text-sm font-medium'>
                                {t('schedule_chapter_section', { label: g.label })}
                            </div>
                            <div className='divide-y'>
                                {g.rows.map((row) => (
                                    <div
                                        key={row.id}
                                        className='flex flex-wrap items-center gap-3 px-3 py-2'
                                    >
                                        <Badge variant='outline'>
                                            {row.item ? row.item.type : 'item'}
                                        </Badge>
                                        <span className='font-mono text-xs'>
                                            #{row.webinar_chapter_item_id}
                                        </span>
                                        <span className='text-sm'>
                                            {fmtUnix(row.start_date)} → {fmtUnix(row.end_date)}
                                        </span>
                                        {row.is_before_start ? (
                                            <Badge variant='secondary'>
                                                {t('schedule_field_is_before_start')}
                                            </Badge>
                                        ) : null}
                                        {row.expiration_check ? (
                                            <Badge variant='secondary'>
                                                {t('schedule_field_expiration_check')}
                                            </Badge>
                                        ) : null}
                                        <div className='ml-auto flex items-center gap-1'>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='ghost'
                                                onClick={() => setEditing(row)}
                                                aria-label={t('edit_schedule')}
                                            >
                                                <Pencil className='h-4 w-4' />
                                            </Button>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='ghost'
                                                onClick={() => handleDelete(row.id)}
                                                aria-label={t('delete_schedule')}
                                            >
                                                <Trash className='h-4 w-4' />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ScheduleRowForm
                open={createOpen}
                onOpenChange={setCreateOpen}
                courseId={courseId}
                groupId={groupId}
                initial={null}
            />
            <ScheduleRowForm
                open={editing !== null}
                onOpenChange={(o) => {
                    if (!o) setEditing(null);
                }}
                courseId={courseId}
                groupId={groupId}
                initial={editing}
            />
        </div>
    );
}
