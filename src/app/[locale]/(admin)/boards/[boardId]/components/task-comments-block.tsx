'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/lib/access/use-permission';
import { useCreateTaskComment, useDeleteTaskComment } from '@/lib/boards/queries';
import type { TaskComment } from '@/lib/boards/types';

export function TaskCommentsBlock({
    boardId,
    taskId,
    comments,
}: {
    boardId: number;
    taskId: string;
    comments: TaskComment[];
}) {
    const t = useTranslations('admin.boards.task');
    const canComment = usePermission('tasks.comment');
    const [content, setContent] = useState('');
    const create = useCreateTaskComment(boardId, taskId);
    const remove = useDeleteTaskComment(boardId, taskId);

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('tab_comments')} {comments.length > 0 && <span className="ml-1 text-foreground">({comments.length})</span>}
            </h4>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {comments.length === 0 && <p className="text-xs italic text-muted-foreground">—</p>}
                {comments.map((c) => (
                    <div key={c.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{t('created_by', { id: c.author_id })}</span>
                            <div className="flex items-center gap-2">
                                <span>{new Date(c.created_at * 1000).toLocaleString('ru-RU')}</span>
                                <button
                                    onClick={() => {
                                        if (confirm('Delete comment?')) {
                                            remove.mutate(c.id);
                                        }
                                    }}
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label="Delete"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{c.content}</p>
                    </div>
                ))}
            </div>

            {canComment && (
                <div className="space-y-2">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="…"
                        rows={2}
                    />
                    <Button
                        size="sm"
                        onClick={() => {
                            const v = content.trim();
                            if (!v) return;
                            create.mutate(v, {
                                onSuccess: () => {
                                    setContent('');
                                    toast.success('OK');
                                },
                            });
                        }}
                        disabled={create.isPending || content.trim().length === 0}
                        className="gap-2"
                    >
                        <Send className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}
