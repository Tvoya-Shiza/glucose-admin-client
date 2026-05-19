'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Trash2, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Button } from '@/components/ui/button';
import { Can } from '@/lib/access/can';
import { useBoard, useBoardTasks, useDeleteBoard } from '@/lib/boards/queries';
import { BoardMembersDialog } from './components/board-members-dialog';
import { KanbanBoardView } from './components/kanban-board-view';
import { TaskDetailDialog } from './components/task-detail-dialog';

/**
 * Single-board page: kanban grid + task-detail modal.
 *
 * Two queries: `useBoard(id)` for board metadata + columns, `useBoardTasks(id)`
 * for the task grid. Kept separate so column rename / add doesn't refetch the
 * whole task list and vice versa.
 */
export function BoardClient({ boardId }: { boardId: number }) {
    const t = useTranslations('admin.boards');
    const tMembers = useTranslations('admin.boards.members');
    const locale = useLocale();
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [membersOpen, setMembersOpen] = useState(false);

    const board = useBoard(boardId);
    const tasks = useBoardTasks(boardId);
    const deleteMutation = useDeleteBoard();

    const headerActions = useMemo(
        () => (
            <div className="flex items-center gap-2">
                <Can permission="boards.manage_members">
                    <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)} className="gap-2">
                        <UsersIcon className="h-4 w-4" /> {tMembers('title')}
                    </Button>
                </Can>
                <Can permission="boards.delete">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (!confirm(t('delete_confirm'))) return;
                            deleteMutation.mutate(boardId, {
                                onSuccess: () => {
                                    window.location.assign(`/${locale}/boards`);
                                },
                            });
                        }}
                        className="gap-2 text-destructive"
                    >
                        <Trash2 className="h-4 w-4" /> {t('delete')}
                    </Button>
                </Can>
            </div>
        ),
        [boardId, deleteMutation, locale, t, tMembers],
    );

    if (board.isLoading || tasks.isLoading) {
        return (
            <PageShell>
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                </div>
            </PageShell>
        );
    }

    if (!board.data) {
        return (
            <PageShell>
                <div className="px-6 py-10 text-center text-muted-foreground">{t('no_access')}</div>
            </PageShell>
        );
    }

    return (
        <PageShell
            header={
                <PageHeader
                    title={
                        <div className="flex items-center gap-3">
                            <Link href={`/${locale}/boards`} className="text-muted-foreground hover:text-foreground" aria-label="Back">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: board.data.color ?? 'var(--primary)' }}
                                aria-hidden
                            />
                            <span>{board.data.name}</span>
                        </div>
                    }
                    subtitle={board.data.description ?? undefined}
                    actions={headerActions}
                />
            }
            contentClassName="p-0"
        >
            <KanbanBoardView
                boardId={boardId}
                columns={board.data.columns}
                tasks={tasks.data?.rows ?? []}
                onOpenTask={setOpenTaskId}
            />

            <TaskDetailDialog
                boardId={boardId}
                taskId={openTaskId}
                open={openTaskId !== null}
                onOpenChange={(open) => {
                    if (!open) setOpenTaskId(null);
                }}
            />

            <BoardMembersDialog boardId={boardId} open={membersOpen} onOpenChange={setMembersOpen} />
        </PageShell>
    );
}
