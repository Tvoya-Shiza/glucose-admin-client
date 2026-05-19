'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { KanbanSquare, Plus, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { EmptyState } from '@/components/admin/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/lib/access/can';
import { useBoards } from '@/lib/boards/queries';
import type { BoardRow } from '@/lib/boards/types';
import { CreateBoardDialog } from './components/create-board-dialog';

/**
 * Boards landing page: grid of cards (one per board) + "Create board" button.
 * Each card links into the kanban view at /boards/[id]. Empty state nudges the
 * actor to create their first board.
 */
export function BoardsListClient() {
    const t = useTranslations('admin.boards');
    const locale = useLocale();
    const [createOpen, setCreateOpen] = useState(false);

    const { data, isLoading } = useBoards();
    const rows = data?.rows ?? [];

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('title')}
                    subtitle={t('subtitle')}
                    actions={
                        <Can permission="boards.create">
                            <Button onClick={() => setCreateOpen(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                {t('create')}
                            </Button>
                        </Can>
                    }
                />
            }
        >
            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-lg" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState icon={KanbanSquare} title={t('empty')} subtitle={t('empty_create_hint')} />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((b) => (
                        <BoardCard
                            key={b.id}
                            board={b}
                            locale={locale}
                            membersLabel={t('members_count', { count: b.member_count })}
                            tasksLabel={t('tasks_count', { count: b.task_count })}
                        />
                    ))}
                </div>
            )}

            <CreateBoardDialog open={createOpen} onOpenChange={setCreateOpen} />
        </PageShell>
    );
}



function BoardCard({
    board,
    locale,
    membersLabel,
    tasksLabel,
}: {
    board: BoardRow;
    locale: string;
    membersLabel: string;
    tasksLabel: string;
}) {
    return (
        <Link href={`/${locale}/boards/${board.id}`} className="block focus:outline-none">
            <Card className="group h-full p-5 transition hover:border-primary hover:shadow-md">
                <div className="flex items-start gap-3">
                    <div
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: board.color ?? 'var(--primary)' }}
                        aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold">{board.name}</h3>
                        {board.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{board.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <UsersIcon className="h-3.5 w-3.5" />
                                {membersLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <KanbanSquare className="h-3.5 w-3.5" />
                                {tasksLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
