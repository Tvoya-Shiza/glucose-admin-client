'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { FileFolder } from '@shared/folders';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renameFolder } from '@/lib/folders/client';
import { FOLDERS_QUERY_KEY } from '@/lib/folders/use-folder-tree';

export interface RenameFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: FileFolder | null;
}

export function RenameFolderDialog({ open, onOpenChange, folder }: RenameFolderDialogProps) {
    const t = useTranslations('files.folders');
    const qc = useQueryClient();
    const [name, setName] = useState('');

    useEffect(() => {
        if (open && folder) setName(folder.name);
    }, [open, folder]);

    const mutation = useMutation({
        mutationFn: () => {
            if (!folder) throw new Error('folder.not_found');
            return renameFolder(folder.id, { name: name.trim() });
        },
        onSuccess: () => {
            toast.success(t('folder_renamed'));
            qc.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            if (err.message === 'folder.slug_taken') {
                toast.error(t('name_taken'));
            } else if (err.message === 'folder.slug_invalid') {
                toast.error(t('slug_invalid'));
            } else {
                toast.error(err.message);
            }
        },
    });

    const canSubmit = name.trim().length > 0 && !mutation.isPending && name.trim() !== folder?.name;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('rename')}</DialogTitle>
                    <DialogDescription>{folder?.path ? '/' + folder.path : t('root')}</DialogDescription>
                </DialogHeader>
                <div className='space-y-2'>
                    <Label htmlFor='folder-rename'>{t('folder_name')}</Label>
                    <Input
                        id='folder-rename'
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSubmit) {
                                e.preventDefault();
                                mutation.mutate();
                            }
                        }}
                        maxLength={120}
                    />
                </div>
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button type='button' onClick={() => mutation.mutate()} disabled={!canSubmit}>
                        {t('rename')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
