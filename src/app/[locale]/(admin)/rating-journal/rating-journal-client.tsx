'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { ClipboardCheck, Plus, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CoursePicker } from '@/components/courses/course-picker';
import { GroupPicker } from '@/components/groups/group-picker';
import { Can } from '@/lib/access/can';
import { usePermission } from '@/lib/access/use-permission';
import { getJournalGrid, syncJournal } from '@/lib/rating-journal/api';
import type { JournalColumn, JournalGrid as JournalGridData } from '@/lib/rating-journal/types';
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
            ) : (
                <Card className='overflow-hidden p-0'>
                    <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
                        <JournalGrid
                            grid={grid}
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
