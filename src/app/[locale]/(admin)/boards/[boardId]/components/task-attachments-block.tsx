'use client';

import { Download, Paperclip, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FileLibraryPicker } from '@/components/ui/file-library-picker';
import { useState } from 'react';
import { usePermission } from '@/lib/access/use-permission';
import { useAddTaskAttachment, useRemoveTaskAttachment } from '@/lib/boards/queries';
import type { TaskAttachment } from '@/lib/boards/types';

/**
 * Attachments use the existing file-library: the user picks an already-uploaded
 * asset OR uploads a new one via the picker, then we POST the upload_asset_id
 * to admin-api which writes the junction row.
 *
 * Direct file display is deferred to a future iteration — for MVP we show ULID
 * + link to /files page where the actual download lives.
 */
export function TaskAttachmentsBlock({
    boardId,
    taskId,
    attachments,
}: {
    boardId: number;
    taskId: string;
    attachments: TaskAttachment[];
}) {
    const canEdit = usePermission('tasks.edit');
    const [pickerOpen, setPickerOpen] = useState(false);

    const add = useAddTaskAttachment(boardId, taskId);
    const remove = useRemoveTaskAttachment(boardId, taskId);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Файлы {attachments.length > 0 && <span className="ml-1 text-foreground">({attachments.length})</span>}
                </h4>
                {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)} className="h-7 gap-1 text-xs">
                        <Plus className="h-3 w-3" /> Добавить
                    </Button>
                )}
            </div>

            {attachments.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">—</p>
            ) : (
                <ul className="space-y-1">
                    {attachments.map((a) => (
                        <li
                            key={a.id}
                            className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1.5 text-xs"
                        >
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="flex-1 truncate font-mono">{a.upload_asset_id}</span>
                            <a
                                href={`/files?file=${a.upload_asset_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </a>
                            {canEdit && (
                                <button
                                    onClick={() => remove.mutate(a.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                    aria-label="Delete"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <FileLibraryPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                kind="image"
                onPick={(url) => {
                    const id = extractUlid(url);
                    if (!id) {
                        toast.error('Не удалось разобрать ID файла');
                        return;
                    }
                    add.mutate(id, {
                        onSuccess: () => {
                            setPickerOpen(false);
                            toast.success('Прикреплено');
                        },
                    });
                }}
            />
        </div>
    );
}

/**
 * Upload URLs have the shape `/static/<kind>/<ulid>.<ext>`. The ULID is 26
 * characters of Crockford-base32 (no I, L, O, U). Pull it out of the filename
 * stem.
 */
function extractUlid(url: string): string | null {
    const m = url.match(/([0-9A-HJKMNP-TV-Z]{26})(?:\.[a-zA-Z0-9]+)?$/);
    return m && m[1] ? m[1] : null;
}
