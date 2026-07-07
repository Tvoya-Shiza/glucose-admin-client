'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { ClipboardCheck, Plus, RefreshCw, Search, X } from 'lucide-react';
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
    const qc = useQueryClient();

    const [{ group_id, course_id }, setSel] = useQueryStates({
        group_id: parseAsInteger,
        course_id: parseAsInteger,
    });

    const canEdit = usePermission('rating_journal.edit');
    const canManage = usePermission('rating_journal.columns_manage');
    const canViewHistory = usePermission('rating_journal.history_view');

    const ready = group_id != null && course_id != null;

    const gridQueryKey = useMemo(() => ['admin.rating-journal.grid', { group_id, course_id }] as const, [group_id, course_id]);

    const { data: grid, isLoading, isFetching, error } = useQuery({
        queryKey: gridQueryKey,
        queryFn: () => getJournalGrid({ group_id: group_id as number, course_id: course_id as number }),
        enabled: ready,
        staleTime: 0,
    });

    const syncMutation = useMutation({
        mutationFn: () => {
            if (!grid) throw new Error('no grid');
            return syncJournal(grid.journal.id);
        },
        onSuccess: (fresh: JournalGridData) => {
            qc.setQueryData(gridQueryKey, fresh);
            // fire-and-forget correctness refresh
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
                </div>
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
