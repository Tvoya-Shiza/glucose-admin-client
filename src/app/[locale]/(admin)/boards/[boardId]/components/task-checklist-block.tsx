'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/lib/access/use-permission';
import {
    useCreateChecklistItem,
    useDeleteChecklistItem,
    useUpdateChecklistItem,
} from '@/lib/boards/queries';
import type { ChecklistItem } from '@/lib/boards/types';

export function TaskChecklistBlock({
    boardId,
    taskId,
    items,
}: {
    boardId: number;
    taskId: string;
    items: ChecklistItem[];
}) {
    const t = useTranslations('admin.boards.task');
    const canEdit = usePermission('tasks.edit');
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');

    const create = useCreateChecklistItem(boardId, taskId);
    const update = useUpdateChecklistItem(boardId, taskId);
    const remove = useDeleteChecklistItem(boardId, taskId);

    const done = items.filter((i) => i.is_done).length;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Чек-лист {items.length > 0 && <span className="ml-1 text-foreground">{done}/{items.length}</span>}
                </h4>
                {canEdit && !adding && (
                    <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="h-7 gap-1 text-xs">
                        <Plus className="h-3 w-3" /> {t('create')}
                    </Button>
                )}
            </div>

            <ul className="space-y-1">
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/30">
                        <Checkbox
                            checked={item.is_done}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                                update.mutate({ itemId: item.id, payload: { is_done: !!checked } })
                            }
                        />
                        <span className={`flex-1 text-sm ${item.is_done ? 'text-muted-foreground line-through' : ''}`}>
                            {item.title}
                        </span>
                        {canEdit && (
                            <button
                                onClick={() => remove.mutate(item.id)}
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Delete"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            {adding && (
                <div className="flex items-center gap-2">
                    <Input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="…"
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setAdding(false);
                                setTitle('');
                            }
                            if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={() => {
                            const v = title.trim();
                            if (v) {
                                create.mutate(v, {
                                    onSuccess: () => {
                                        setTitle('');
                                    },
                                });
                            }
                            setAdding(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
