'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/lib/access/use-permission';
import { useCreateColumn } from '@/lib/boards/queries';

export function CreateColumnButton({ boardId }: { boardId: number }) {
    const t = useTranslations('admin.boards');
    const canManage = usePermission('boards.manage_columns');
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const createColumn = useCreateColumn(boardId);

    if (!canManage) return null;

    return (
        <div className="w-72 shrink-0">
            {open ? (
                <div className="space-y-2 rounded-lg border border-dashed border-border bg-card/40 p-3">
                    <Input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('column.create_placeholder')}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setOpen(false);
                                setName('');
                            }
                        }}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => {
                                const v = name.trim();
                                if (!v) return;
                                createColumn.mutate(
                                    { name: v },
                                    {
                                        onSuccess: () => {
                                            toast.success(t('column.create_success'));
                                            setName('');
                                            setOpen(false);
                                        },
                                    },
                                );
                            }}
                            disabled={createColumn.isPending || name.trim().length === 0}
                        >
                            {t('column.create')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setOpen(false);
                                setName('');
                            }}
                        >
                            {t('form.cancel')}
                        </Button>
                    </div>
                </div>
            ) : (
                <Button
                    variant="outline"
                    onClick={() => setOpen(true)}
                    className="h-12 w-full gap-2 border-dashed text-muted-foreground"
                >
                    <Plus className="h-4 w-4" /> {t('column.create')}
                </Button>
            )}
        </div>
    );
}
