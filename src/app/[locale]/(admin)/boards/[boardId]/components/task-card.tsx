'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    CalendarClock,
    CheckCircle2,
    CheckSquare,
    MessageSquare,
    Paperclip,
    Users as UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { TaskRow } from '@/lib/boards/types';

const PRIORITY_COLORS: Record<TaskRow['priority'], string> = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-800',
    urgent: 'bg-red-100 text-red-700',
};

function formatDueDate(unix: number) {
    return new Date(unix * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export function TaskCard({
    task,
    onClick,
    dragging,
}: {
    task: TaskRow;
    onClick?: () => void;
    dragging?: boolean;
}) {
    const tPriority = useTranslations('admin.boards.task');
    const sortable = useSortable({ id: `task-${task.id}`, disabled: dragging });
    const style = sortable
        ? {
              transform: CSS.Transform.toString(sortable.transform),
              transition: sortable.transition,
              opacity: sortable.isDragging ? 0.4 : undefined,
          }
        : undefined;

    const now = Math.floor(Date.now() / 1000);
    const overdue = task.due_at !== null && task.completed_at === null && task.due_at < now;
    const dueSoon = task.due_at !== null && !overdue && task.completed_at === null && task.due_at - now < 86_400;

    const completed = task.completed_at !== null;

    return (
        <Card
            ref={dragging ? undefined : sortable?.setNodeRef}
            style={style}
            className={`cursor-grab select-none p-3 shadow-sm transition hover:shadow ${
                dragging ? 'cursor-grabbing rotate-2 shadow-lg' : ''
            } ${completed ? 'bg-muted/60 opacity-60 saturate-50' : ''}`}
            onClick={onClick}
            {...(dragging ? {} : sortable?.attributes)}
            {...(dragging ? {} : sortable?.listeners)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-start gap-1.5">
                    {completed && (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    )}
                    <p
                        className={`text-sm font-medium leading-snug ${
                            completed ? 'text-muted-foreground line-through decoration-muted-foreground/70' : ''
                        }`}
                    >
                        {task.title}
                    </p>
                </div>
                <Badge className={`shrink-0 text-[10px] ${PRIORITY_COLORS[task.priority]}`}>
                    {tPriority(`priority_${task.priority}`)}
                </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {task.due_at !== null && (
                    <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                            overdue ? 'bg-red-100 text-red-700' : dueSoon ? 'bg-amber-100 text-amber-700' : ''
                        }`}
                    >
                        <CalendarClock className="h-3 w-3" /> {formatDueDate(task.due_at)}
                    </span>
                )}
                {task.assignee_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" /> {task.assignee_count}
                    </span>
                )}
                {task.checklist_total > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" /> {task.checklist_done}/{task.checklist_total}
                    </span>
                )}
                {task.comment_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {task.comment_count}
                    </span>
                )}
                {task.attachment_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> {task.attachment_count}
                    </span>
                )}
            </div>
        </Card>
    );
}
