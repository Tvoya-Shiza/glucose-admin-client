'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
import { createFolder } from '@/lib/folders/client';
import { FOLDERS_QUERY_KEY } from '@/lib/folders/use-folder-tree';

export interface CreateFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentId: number | null;
    onCreated?: (folderId: number) => void;
}

/**
 * "New folder" dialog. Creates a folder under `parentId` (null = root) and
 * invalidates the folders + uploads query keys so the tree refreshes.
 */
export function CreateFolderDialog({ open, onOpenChange, parentId, onCreated }: CreateFolderDialogProps) {
    const t = useTranslations('files.folders');
    const qc = useQueryClient();
    const [name, setName] = useState('');

    useEffect(() => {
        if (open) setName('');
    }, [open]);

    const mutation = useMutation({
        mutationFn: () => createFolder({ name: name.trim(), parent_id: parentId }),
        onSuccess: (folder) => {
            toast.success(t('folder_created'));
            qc.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            onOpenChange(false);
            onCreated?.(folder.id);
        },
        onError: (err: Error) => {
            const message = err.message;
            if (message === 'folder.slug_taken') {
                toast.error(t('name_taken'));
            } else if (message === 'folder.slug_invalid') {
                toast.error(t('slug_invalid'));
            } else {
                toast.error(message);
            }
        },
    });

    const canSubmit = name.trim().length > 0 && !mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('new_folder')}</DialogTitle>
                    <DialogDescription>{t('folder_name')}</DialogDescription>
                </DialogHeader>
                <div className='space-y-2'>
                    <Label htmlFor='folder-name'>{t('folder_name')}</Label>
                    <Input
                        id='folder-name'
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
                        {t('create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
