'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getScheduleCalendar } from '@/lib/schedules/api';
import type { Schedule } from '@/lib/schedules/types';
import { formatScheduleTime, htmlToPlainText } from '@/lib/schedules/format';
import type { ScheduleFiltersValue } from './schedules-filters';

interface SchedulesCalendarProps {
    filters: ScheduleFiltersValue;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (schedule: Schedule) => void;
    onDelete: (schedule: Schedule) => void;
}

interface MonthDay {
    date: Date;
    inMonth: boolean;
    startSec: number;
    endSec: number;
}

const STATUS_COLOR: Record<string, string> = {
    draft: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100',
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100',
    in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100',
    cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100',
};

export function SchedulesCalendar({ filters, canEdit, onEdit }: SchedulesCalendarProps) {
    const t = useTranslations('admin.schedules');
    const locale = useLocale();
    const [cursor, setCursor] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const monthDays = useMemo(() => buildMonthDays(cursor), [cursor]);
    const windowFrom = monthDays[0]?.startSec ?? 0;
    const windowTo = monthDays[monthDays.length - 1]?.endSec ?? 0;

    const { data, isFetching } = useQuery({
        queryKey: ['admin.schedules.calendar', windowFrom, windowTo, filters],
        queryFn: () =>
            getScheduleCalendar({
                from: windowFrom,
                to: windowTo,
                curator_id: filters.curator_id,
                group_id: filters.group_id,
                course_id: filters.course_id,
                status: filters.status,
            }),
        placeholderData: (prev) => prev,
    });

    const monthLabel = new Intl.DateTimeFormat(locale === 'kz' ? 'kk-KZ' : 'ru-RU', {
        month: 'long',
        year: 'numeric',
    }).format(cursor);

    const weekdayLabels = useMemo(() => buildWeekdayLabels(locale), [locale]);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, Schedule[]>();
        const rows = data?.rows ?? [];
        for (const day of monthDays) {
            const key = dayKey(day.date);
            const items = rows.filter((s) => s.start_at <= day.endSec && s.end_at >= day.startSec);
            map.set(key, items);
        }
        return map;
    }, [data, monthDays]);

    return (
        <Card className='overflow-hidden'>
            <div className='flex items-center justify-between border-b bg-card px-4 py-3'>
                <div className='flex items-center gap-1.5'>
                    <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    >
                        <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                            const d = new Date();
                            setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                        }}
                    >
                        {t('today')}
                    </Button>
                    <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    >
                        <ChevronRight className='h-4 w-4' />
                    </Button>
                </div>
                <h2 className='text-base font-semibold capitalize tabular-nums'>{monthLabel}</h2>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                    {isFetching ? t('loading') : t('events_in_month', { count: data?.rows.length ?? 0 })}
                </div>
            </div>

            <div className='grid grid-cols-7 gap-px border-b bg-border text-center text-xs font-medium text-muted-foreground'>
                {weekdayLabels.map((label) => (
                    <div key={label} className='bg-card px-2 py-1.5'>
                        {label}
                    </div>
                ))}
            </div>

            <div className='grid grid-cols-7 gap-px bg-border'>
                {monthDays.map((day) => {
                    const events = eventsByDay.get(dayKey(day.date)) ?? [];
                    const isToday = sameDay(day.date, new Date());
                    return (
                        <div
                            key={day.date.toISOString()}
                            className={cn(
                                'flex min-h-[112px] flex-col gap-1 bg-card p-1.5',
                                !day.inMonth && 'bg-muted/40 text-muted-foreground',
                            )}
                        >
                            <div className='flex items-center justify-between'>
                                <span
                                    className={cn(
                                        'text-xs tabular-nums',
                                        isToday && 'rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground',
                                    )}
                                >
                                    {day.date.getDate()}
                                </span>
                            </div>
                            <div className='flex flex-col gap-0.5'>
                                {isFetching && events.length === 0 ? (
                                    <Skeleton className='h-6 w-full' />
                                ) : (
                                    events.slice(0, 4).map((ev) => (
                                        <button
                                            key={ev.id}
                                            type='button'
                                            disabled={!canEdit}
                                            onClick={() => canEdit && onEdit(ev)}
                                            className={cn(
                                                'truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity',
                                                STATUS_COLOR[ev.status],
                                                canEdit ? 'hover:opacity-80' : 'cursor-default',
                                            )}
                                            title={ev.description ? htmlToPlainText(ev.description) : ev.group_name}
                                        >
                                            <span className='mr-1 tabular-nums'>
                                                {formatScheduleTime(ev.start_at, locale)}
                                            </span>
                                            <span className='truncate'>
                                                {ev.group_name}
                                                {ev.items.length > 0
                                                    ? ` · ${ev.items.length} ${t('items_short')}`
                                                    : ''}
                                            </span>
                                        </button>
                                    ))
                                )}
                                {events.length > 4 ? (
                                    <span className='px-1.5 text-[11px] text-muted-foreground'>
                                        {t('more_count', { count: events.length - 4 })}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function buildMonthDays(cursor: Date): MonthDay[] {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // ISO week starts on Monday — shift Sunday(0) to 6
    const dow = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - dow);
    const days: MonthDay[] = [];
    for (let i = 0; i < 42; i += 1) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const startSec = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000);
        const endSec = Math.floor(
            new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() / 1000,
        );
        days.push({ date: d, inMonth: d.getMonth() === cursor.getMonth(), startSec, endSec });
    }
    return days;
}

function buildWeekdayLabels(locale: string): string[] {
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    // 2024-01-01 was a Monday — use that anchor.
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2024, 0, 1 + i);
        return fmt.format(d).replace('.', '');
    });
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
