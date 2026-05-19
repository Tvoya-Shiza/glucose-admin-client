'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, CheckCircle2, Circle, Loader2, Trash2, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Can } from '@/lib/access/can';
import { usePermission } from '@/lib/access/use-permission';
import {
    useDeleteTask,
    useSetTaskAssignees,
    useTask,
    useUpdateTask,
} from '@/lib/boards/queries';
import type { TaskAssigneeRow, TaskPriority } from '@/lib/boards/types';
import { AssigneePicker } from './assignee-picker';
import { TaskAttachmentsBlock } from './task-attachments-block';
import { TaskChecklistBlock } from './task-checklist-block';
import { TaskCommentsBlock } from './task-comments-block';
import { useAssigneeName } from './use-assignee-name';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

/**
 * Task detail modal. Loads `useTask(boardId, taskId)` on open; fields are
 * controlled by local state, persisted on blur / explicit "save" press to keep
 * the cache invalidation rate low.
 *
 * Phase 4 will add tabs: Comments / Activity. The Overview tab is the only one
 * present in Phase 3.
 */
export function TaskDetailDialog({
    boardId,
    taskId,
    open,
    onOpenChange,
}: {
    boardId: number;
    taskId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const t = useTranslations('admin.boards.task');
    const tForm = useTranslations('admin.boards.form');
    const query = useTask(boardId, taskId);
    const canEdit = usePermission('tasks.edit');
    const canAssign = usePermission('tasks.assign');

    const updateMutation = useUpdateTask(boardId, taskId ?? '');
    const deleteMutation = useDeleteTask(boardId);
    const assigneesMutation = useSetTaskAssignees(boardId, taskId ?? '');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [dueAt, setDueAt] = useState<string>(''); // datetime-local string
    const [assignees, setAssignees] = useState<TaskAssigneeRow[]>([]);

    useEffect(() => {
        if (!query.data) return;
        setTitle(query.data.title);
        setDescription(query.data.description ?? '');
        setPriority(query.data.priority);
        setDueAt(query.data.due_at ? toLocalDatetimeInput(query.data.due_at) : '');
        setAssignees(query.data.assignees);
    }, [query.data]);

    const save = () => {
        if (!query.data) return;
        const payload: Parameters<typeof updateMutation.mutate>[0] = {};
        const trimmedTitle = title.trim();
        if (trimmedTitle && trimmedTitle !== query.data.title) payload.title = trimmedTitle;
        const trimmedDescription = description.trim();
        const currentDescription = query.data.description ?? '';
        if (trimmedDescription !== currentDescription) {
            payload.description = trimmedDescription || null;
        }
        if (priority !== query.data.priority) payload.priority = priority;
        const newDueAt = dueAt ? fromLocalDatetimeInput(dueAt) : null;
        if (newDueAt !== query.data.due_at) payload.due_at = newDueAt;

        if (Object.keys(payload).length === 0) {
            onOpenChange(false);
            return;
        }
        updateMutation.mutate(payload, {
            onSuccess: () => {
                toast.success(t('save_success'));
                onOpenChange(false);
            },
            onError: () => toast.error(t('save_failed')),
        });
    };

    const handleAssigneesChange = (next: TaskAssigneeRow[]) => {
        setAssignees(next);
        // Persist immediately (small payload — saves an explicit "save").
        assigneesMutation.mutate({
            assignees: next.map((a) =>
                a.assignee_type === 'everyone'
                    ? { assignee_type: 'everyone' as const }
                    : { assignee_type: a.assignee_type, assignee_id: a.assignee_id ?? undefined },
            ),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle asChild>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={!canEdit}
                            className={`border-0 px-0 text-lg font-semibold focus-visible:ring-0 ${
                                query.data?.completed_at ? 'line-through opacity-60' : ''
                            }`}
                            placeholder={t('title_placeholder')}
                        />
                    </DialogTitle>
                    <DialogDescription className="sr-only">Карточка задачи</DialogDescription>
                </DialogHeader>

                {!query.data ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                {t('description_label')}
                            </label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={!canEdit}
                                rows={4}
                                placeholder={t('description_placeholder')}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                    {t('priority_label')}
                                </label>
                                <Select
                                    value={priority}
                                    onValueChange={(v) => setPriority(v as TaskPriority)}
                                    disabled={!canEdit}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORITIES.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {t(`priority_${p}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                    <Calendar className="mr-1 inline h-3 w-3" /> {t('due_at_label')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="datetime-local"
                                        value={dueAt}
                                        onChange={(e) => setDueAt(e.target.value)}
                                        disabled={!canEdit}
                                    />
                                    {dueAt && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setDueAt('')}
                                            disabled={!canEdit}
                                            aria-label={t('due_at_clear')}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted-foreground">
                                <UsersIcon className="mr-1 inline h-3 w-3" /> {t('assignees_label')}
                            </label>
                            {assignees.length === 0 && (
                                <p className="text-xs italic text-muted-foreground">{t('no_assignees')}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                                {assignees.map((a) => (
                                    <Badge key={a.id} variant="secondary" className="gap-1.5">
                                        <AssigneeLabel row={a} />
                                        {canAssign && (
                                            <button
                                                onClick={() =>
                                                    handleAssigneesChange(assignees.filter((x) => x.id !== a.id))
                                                }
                                                className="hover:text-destructive"
                                                aria-label={t('assignee_remove')}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                            {canAssign && (
                                <AssigneePicker
                                    onPick={(picked) => {
                                        const exists = assignees.some(
                                            (a) => a.assignee_type === picked.assignee_type && a.assignee_id === picked.assignee_id,
                                        );
                                        if (exists) return;
                                        handleAssigneesChange([
                                            ...assignees,
                                            {
                                                id: -Date.now(), // optimistic temp id
                                                assignee_type: picked.assignee_type,
                                                assignee_id: picked.assignee_id,
                                                assigned_by: 0,
                                                created_at: Math.floor(Date.now() / 1000),
                                            },
                                        ]);
                                    }}
                                />
                            )}
                        </div>

                        <Separator />

                        <TaskChecklistBlock boardId={boardId} taskId={taskId!} items={query.data.checklist} />

                        <Separator />

                        <TaskAttachmentsBlock boardId={boardId} taskId={taskId!} attachments={query.data.attachments} />

                        <Separator />

                        <TaskCommentsBlock boardId={boardId} taskId={taskId!} comments={query.data.comments} />

                        <Separator />

                        <div className="flex items-center justify-between">
                            <Can permission="tasks.delete">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (!confirm(t('delete_confirm'))) return;
                                        deleteMutation.mutate(taskId!, {
                                            onSuccess: () => {
                                                toast.success(t('delete_success'));
                                                onOpenChange(false);
                                            },
                                        });
                                    }}
                                    className="gap-2 text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" /> {t('delete')}
                                </Button>
                            </Can>
                            <div className="flex items-center gap-2">
                                {canEdit && (
                                    <Button
                                        type="button"
                                        variant={query.data.completed_at ? 'secondary' : 'outline'}
                                        onClick={() => {
                                            const willBeCompleted = query.data!.completed_at === null;
                                            updateMutation.mutate(
                                                { completed: willBeCompleted },
                                                {
                                                    onSuccess: () =>
                                                        toast.success(
                                                            willBeCompleted ? 'Задача закрыта' : 'Задача открыта',
                                                        ),
                                                },
                                            );
                                        }}
                                        disabled={updateMutation.isPending}
                                        className={`gap-2 ${
                                            query.data.completed_at
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                : ''
                                        }`}
                                    >
                                        {query.data.completed_at ? (
                                            <>
                                                <CheckCircle2 className="h-4 w-4" /> Задача закрыта
                                            </>
                                        ) : (
                                            <>
                                                <Circle className="h-4 w-4" /> Закрыть задачу
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                    {tForm('cancel')}
                                </Button>
                                <Button onClick={save} disabled={updateMutation.isPending || !canEdit}>
                                    {t('save')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AssigneeLabel({ row }: { row: TaskAssigneeRow }) {
    const { label, isLoading } = useAssigneeName(row.assignee_type, row.assignee_id);
    const icon = row.assignee_type === 'user' ? '👤' : row.assignee_type === 'role' ? '🛡' : row.assignee_type === 'group' ? '👥' : '🌐';
    return (
        <span>
            {icon} {isLoading ? '…' : label}
        </span>
    );
}

function toLocalDatetimeInput(unix: number): string {
    const d = new Date(unix * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(local: string): number {
    return Math.floor(new Date(local).getTime() / 1000);
}
