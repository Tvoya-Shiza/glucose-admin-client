'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Can } from '@/lib/access/can';
import { useCreateTask, useDeleteColumn, useUpdateColumn } from '@/lib/boards/queries';
import type { BoardColumn, TaskRow } from '@/lib/boards/types';
import { TaskCard } from './task-card';

export function BoardColumnView({
    boardId,
    column,
    tasks,
    onOpenTask,
}: {
    boardId: number;
    column: BoardColumn;
    tasks: TaskRow[];
    onOpenTask: (taskId: string) => void;
}) {
    const t = useTranslations('admin.boards');
    const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });
    const [renaming, setRenaming] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const updateColumn = useUpdateColumn(boardId);
    const deleteColumn = useDeleteColumn(boardId);
    const createTask = useCreateTask(boardId);

    return (
        <div className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-border bg-card/40">
            <div className="flex items-center justify-between px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: column.color ?? 'var(--muted-foreground)' }}
                        aria-hidden
                    />
                    {renaming ? (
                        <Input
                            autoFocus
                            defaultValue={column.name}
                            onBlur={(e) => {
                                const v = e.currentTarget.value.trim();
                                setRenaming(false);
                                if (v && v !== column.name) {
                                    updateColumn.mutate(
                                        { columnId: column.id, payload: { name: v } },
                                        { onSuccess: () => toast.success(t('column.rename_success')) },
                                    );
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') {
                                    setRenaming(false);
                                }
                            }}
                            className="h-7 text-sm"
                        />
                    ) : (
                        <button
                            onClick={() => setRenaming(true)}
                            className="truncate text-sm font-semibold hover:text-primary"
                        >
                            {column.name}
                        </button>
                    )}
                    <span className="text-xs text-muted-foreground">{tasks.length}</span>
                </div>
                <Can permission="boards.manage_columns">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setRenaming(true)}>{t('column.rename')}</DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                    if (!confirm(t('column.delete_confirm'))) return;
                                    deleteColumn.mutate(column.id, {
                                        onSuccess: () => toast.success(t('column.delete_success')),
                                    });
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> {t('column.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Can>
            </div>

            <div
                ref={setNodeRef}
                className={`flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 ${isOver ? 'bg-primary/5' : ''}`}
            >
                {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={() => onOpenTask(task.id)} />
                ))}
            </div>

            <Can permission="tasks.create">
                <div className="border-t border-border p-2">
                    {adding ? (
                        <div className="space-y-2">
                            <Input
                                autoFocus
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder={t('task.title_placeholder')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setAdding(false);
                                        setNewTitle('');
                                    }
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        const v = newTitle.trim();
                                        if (!v) return;
                                        createTask.mutate(
                                            { title: v, column_id: column.id },
                                            {
                                                onSuccess: () => {
                                                    toast.success(t('task.create_success'));
                                                    setNewTitle('');
                                                    setAdding(false);
                                                },
                                                onError: () => toast.error(t('task.create_failed')),
                                            },
                                        );
                                    }}
                                    disabled={createTask.isPending || newTitle.trim().length === 0}
                                >
                                    {t('task.create')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setAdding(false);
                                        setNewTitle('');
                                    }}
                                >
                                    {t('form.cancel')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAdding(true)}
                            className="w-full justify-start gap-2 text-muted-foreground"
                        >
                            <Plus className="h-4 w-4" /> {t('task.create')}
                        </Button>
                    )}
                </div>
            </Can>
        </div>
    );
}
