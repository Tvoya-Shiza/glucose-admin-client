'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { CalendarRange, ClipboardCheck, Plus, RefreshCw, Search, X } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CoursePicker } from '@/components/courses/course-picker';
import { GroupPicker } from '@/components/groups/group-picker';
import { Can } from '@/lib/access/can';
import { usePermission } from '@/lib/access/use-permission';
import { getJournalGrid, syncJournal } from '@/lib/rating-journal/api';
import type { JournalColumn, JournalGrid as JournalGridData, StudentStatus } from '@/lib/rating-journal/types';

const STATUS_ALL = 'all';
type StatusFilter = StudentStatus | typeof STATUS_ALL;

/** 'YYYY-MM-DD' → unix seconds (local). endOfDay pins 23:59:59 for inclusive upper bounds. */
function dayToUnix(day: string | null, endOfDay: boolean): number | undefined {
    if (!day) return undefined;
    const d = new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    const ms = d.getTime();
    return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

/**
 * Local 'YYYY-MM-DD'. Deliberately not toISOString().slice(0, 10) — that converts
 * to UTC first, so in Almaty (UTC+5) every moment before 05:00 would yield the
 * previous day and the journal would open on the wrong week.
 */
function toLocalDay(d: Date): string {
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Понедельник–воскресенье текущей недели. getDay() отдаёт 0 для воскресенья,
 * поэтому (getDay() + 6) % 7 — это число дней, прошедших с понедельника.
 * Date сам нормализует отрицательные числа и переход через границу месяца.
 */
function currentWeekRange(): { from: string; to: string } {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toLocalDay(monday), to: toLocalDay(sunday) };
}

/**
 * Явный маркер «весь период» в URL.
 *
 * Пустая строка тут не годится: раз у параметра есть непустой дефолт (текущая
 * неделя), «выключено» нужно чем-то записать — а пустой query-параметр по пути
 * через историю браузера легко теряется, и журнал молча вернулся бы на неделю.
 * Слово в URL переживает перезагрузку и читается человеком.
 */
const ALL_PERIOD = 'all';

/** Значение фильтра → день для запроса; маркер «весь период» снимает границу. */
function periodBound(value: string): string | null {
    return !value || value === ALL_PERIOD ? null : value;
}
import { CellHistoryDialog, type CellHistoryTarget } from './components/cell-history-dialog';
import { CreateColumnDialog } from './components/create-column-dialog';
import { EditColumnDialog } from './components/edit-column-dialog';
import { ExportMenu } from './components/export-menu';
import { JournalGrid } from './components/journal-grid';

/**
 * Рейтинг-журнал — gradebook page. Group + course pickers drive the grid load;
 * the editable sticky grid, column management, drag-reorder, sync, export and
 * edit-log all hang off the loaded JournalGrid. Mirrors CreditsListClient
 * (TanStack Query + nuqs + PageShell/PageHeader).
 */
export function RatingJournalClient() {
    const t = useTranslations('admin.ratingJournal');
    const locale = useLocale();
    const qc = useQueryClient();

    // Computed once per mount so the nuqs defaults stay referentially stable.
    const week = useMemo(currentWeekRange, []);

    const [{ group_id, course_id, date_from, date_to }, setSel] = useQueryStates(
        useMemo(
            () => ({
                group_id: parseAsInteger,
                course_id: parseAsInteger,
                // Calendar filter (item 5) — YYYY-MM-DD strings; converted to unix at query time.
                // Defaults to the current week: the curator almost always wants "what
                // happened this week", and the unfiltered grid grows unreadable over a
                // semester. ALL_PERIOD is the explicit escape — distinct from "not
                // set", which is what withDefault fills in.
                date_from: parseAsString.withDefault(week.from),
                date_to: parseAsString.withDefault(week.to),
            }),
            [week],
        ),
    );

    const fromDay = periodBound(date_from);
    const toDay = periodBound(date_to);
    const isCurrentWeek = date_from === week.from && date_to === week.to;
    const isAllPeriod = fromDay === null && toDay === null;

    // «5–11 тамыз» — the range the grid actually shows, spelled out so the default
    // filter can never be mistaken for "the journal is empty".
    const periodLabel = useMemo(() => {
        if (isAllPeriod) return null;
        const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
        const fmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long' });
        const from = fromDay ? fmt.format(new Date(`${fromDay}T00:00:00`)) : '…';
        const to = toDay ? fmt.format(new Date(`${toDay}T00:00:00`)) : '…';
        return `${from} — ${to}`;
    }, [fromDay, toDay, isAllPeriod, locale]);

    const canEdit = usePermission('rating_journal.edit');
    const canManage = usePermission('rating_journal.columns_manage');
    const canViewHistory = usePermission('rating_journal.history_view');

    const ready = group_id != null && course_id != null;

    // date_from → start of its day; date_to → end of its day (inclusive).
    const dateFromUnix = useMemo(() => dayToUnix(fromDay, false), [fromDay]);
    const dateToUnix = useMemo(() => dayToUnix(toDay, true), [toDay]);

    const gridQueryKey = useMemo(
        () => ['admin.rating-journal.grid', { group_id, course_id, date_from, date_to }] as const,
        [group_id, course_id, date_from, date_to],
    );

    const { data: grid, isLoading, isFetching, error } = useQuery({
        queryKey: gridQueryKey,
        queryFn: () =>
            getJournalGrid({
                group_id: group_id as number,
                course_id: course_id as number,
                date_from: dateFromUnix,
                date_to: dateToUnix,
            }),
        enabled: ready,
        staleTime: 0,
    });

    const syncMutation = useMutation({
        mutationFn: () => {
            if (!grid) throw new Error('no grid');
            return syncJournal(grid.journal.id);
        },
        onSuccess: (fresh: JournalGridData) => {
            // The sync endpoint returns the FULL (unfiltered) grid. When a date
            // filter is active, writing it straight into the cache would show
            // out-of-range cells + inflated totals — so refetch to re-apply the
            // filter instead. Without a filter, the fresh grid is authoritative.
            if (!isAllPeriod) {
                qc.invalidateQueries({ queryKey: gridQueryKey });
            } else {
                qc.setQueryData(gridQueryKey, fresh);
            }
        },
        onError: (err: Error) => {
            // eslint-disable-next-line no-console
            console.error(err);
        },
    });

    const [createOpen, setCreateOpen] = useState(false);
    const [editColumn, setEditColumn] = useState<JournalColumn | null>(null);
    const [historyTarget, setHistoryTarget] = useState<CellHistoryTarget | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>(STATUS_ALL);

    // Client-side ФИО + status filter over the loaded group roster (class-sized,
    // always fully loaded) — instant, no refetch, no re-sync per keystroke.
    // Optimistic cell/column mutations still target the full grid via
    // gridQueryKey, so filtering rows here can't clobber the cache.
    const displayGrid = useMemo(() => {
        if (!grid) return grid;
        const q = search.trim().toLowerCase();
        if (!q && status === STATUS_ALL) return grid;
        const rows = grid.rows.filter(
            (r) => (status === STATUS_ALL || r.status === status) && (!q || (r.full_name ?? '').toLowerCase().includes(q)),
        );
        return { ...grid, rows };
    }, [grid, search, status]);

    const nextPosition = useMemo(() => (grid ? grid.columns.reduce((max, c) => Math.max(max, c.position), 0) + 1 : 1), [grid]);

    const openHistory = (columnId: string, studentId: number) => {
        if (!grid) return;
        const col = grid.columns.find((c) => c.id === columnId);
        const row = grid.rows.find((r) => r.student_id === studentId);
        setHistoryTarget({
            columnId,
            studentId,
            columnTitle: col?.title ?? columnId,
            studentName: row?.full_name ?? `#${studentId}`,
        });
    };

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        grid ? (
                            <>
                                <Can permission='rating_journal.export'>
                                    <ExportMenu grid={grid} />
                                </Can>
                                {canManage ? (
                                    <Button variant='outline' size='sm' onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                                        <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                        {syncMutation.isPending ? t('syncing') : t('sync')}
                                    </Button>
                                ) : null}
                                {canManage ? (
                                    <Button size='sm' onClick={() => setCreateOpen(true)}>
                                        <Plus className='mr-2 h-4 w-4' />
                                        {t('add_column')}
                                    </Button>
                                ) : null}
                            </>
                        ) : null
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Card className='p-4'>
                <div className='flex flex-wrap items-end gap-4'>
                    <div className='w-64'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('group_label')}</label>
                        <GroupPicker
                            value={group_id ?? null}
                            onChange={(id) => setSel({ group_id: id ?? null })}
                            placeholder={t('group_placeholder')}
                        />
                    </div>
                    <div className='w-64'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('course_label')}</label>
                        <CoursePicker
                            value={course_id ?? null}
                            onChange={(id) => setSel({ course_id: id ?? null })}
                            placeholder={t('course_placeholder')}
                        />
                    </div>
                    <div className='w-64'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('search_label')}</label>
                        <div className='relative'>
                            <Search className='text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                disabled={!ready}
                                placeholder={t('search_placeholder')}
                                className='px-8'
                            />
                            {search ? (
                                <button
                                    type='button'
                                    onClick={() => setSearch('')}
                                    aria-label={t('search_clear')}
                                    className='text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2'
                                >
                                    <X className='h-4 w-4' />
                                </button>
                            ) : null}
                        </div>
                    </div>
                    <div className='w-44'>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('status_label')}</label>
                        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)} disabled={!ready}>
                            <SelectTrigger className='w-full'>
                                <SelectValue placeholder={t('status_all')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={STATUS_ALL}>{t('status_all')}</SelectItem>
                                <SelectItem value='active'>{t('status_active')}</SelectItem>
                                <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                                <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Calendar filter (item 5): show only grades entered within the range. */}
                    <div>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('date_from_label')}</label>
                        <Input
                            type='date'
                            value={fromDay ?? ''}
                            max={toDay ?? undefined}
                            onChange={(e) => setSel({ date_from: e.target.value })}
                            disabled={!ready}
                            className='w-40'
                        />
                    </div>
                    <div>
                        <label className='text-muted-foreground mb-1 block text-xs font-medium'>{t('date_to_label')}</label>
                        <Input
                            type='date'
                            value={toDay ?? ''}
                            min={fromDay ?? undefined}
                            onChange={(e) => setSel({ date_to: e.target.value })}
                            disabled={!ready}
                            className='w-40'
                        />
                    </div>
                    {isAllPeriod ? (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => setSel({ date_from: week.from, date_to: week.to })}
                            disabled={!ready}
                        >
                            <CalendarRange className='mr-1 h-4 w-4' />
                            {t('period_current_week')}
                        </Button>
                    ) : (
                        <Button variant='ghost' size='sm' onClick={() => setSel({ date_from: ALL_PERIOD, date_to: ALL_PERIOD })} disabled={!ready}>
                            <X className='mr-1 h-4 w-4' />
                            {t('period_all')}
                        </Button>
                    )}
                </div>
                {/* The default filter is invisible otherwise: a curator who sees three
                    columns instead of thirty must be told it is a date range, not a bug. */}
                <p className='text-muted-foreground mt-3 text-xs'>
                    {isAllPeriod
                        ? t('period_hint_all')
                        : isCurrentWeek
                          ? t('period_hint_week', { range: periodLabel ?? '' })
                          : t('period_hint_custom', { range: periodLabel ?? '' })}
                </p>
            </Card>

            {!ready ? (
                <EmptyState icon={ClipboardCheck} title={t('select_group_course')} />
            ) : error ? (
                <EmptyState icon={ClipboardCheck} title={t('no_journal')} subtitle={(error as Error).message} />
            ) : isLoading ? (
                <Card className='space-y-2 p-4'>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className='h-9 w-full' />
                    ))}
                </Card>
            ) : !grid || grid.rows.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title={t('empty_grid')} />
            ) : !displayGrid || displayGrid.rows.length === 0 ? (
                <EmptyState
                    icon={Search}
                    title={search.trim() ? t('no_search_results', { query: search.trim() }) : t('no_filter_results')}
                />
            ) : (
                <Card className='overflow-hidden p-0'>
                    <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
                        <JournalGrid
                            grid={displayGrid}
                            gridQueryKey={gridQueryKey}
                            canEdit={canEdit}
                            canManage={canManage}
                            canViewHistory={canViewHistory}
                            onEditColumn={(c) => setEditColumn(c)}
                            onOpenHistory={openHistory}
                        />
                    </div>
                </Card>
            )}

            {canManage && grid ? (
                <CreateColumnDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    journalId={grid.journal.id}
                    gridQueryKey={gridQueryKey}
                    nextPosition={nextPosition}
                />
            ) : null}
            {canManage ? (
                <EditColumnDialog
                    open={editColumn !== null}
                    onOpenChange={(o) => {
                        if (!o) setEditColumn(null);
                    }}
                    column={editColumn}
                    gridQueryKey={gridQueryKey}
                />
            ) : null}
            {canViewHistory ? (
                <CellHistoryDialog
                    target={historyTarget}
                    onOpenChange={(o) => {
                        if (!o) setHistoryTarget(null);
                    }}
                />
            ) : null}
        </PageShell>
    );
}
