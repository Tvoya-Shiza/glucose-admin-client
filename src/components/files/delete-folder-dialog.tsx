'use client';

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
import { deleteFolder } from '@/lib/folders/client';
import { FOLDERS_QUERY_KEY } from '@/lib/folders/use-folder-tree';

export interface DeleteFolderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folder: FileFolder | null;
    onDeleted?: () => void;
}

export function DeleteFolderDialog({ open, onOpenChange, folder, onDeleted }: DeleteFolderDialogProps) {
    const t = useTranslations('files.folders');
    const qc = useQueryClient();

    const empty = !!folder && folder.children_count === 0 && folder.files_count === 0;

    const mutation = useMutation({
        mutationFn: () => {
            if (!folder) throw new Error('folder.not_found');
            return deleteFolder(folder.id);
        },
        onSuccess: () => {
            toast.success(t('folder_deleted'));
            qc.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY });
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            onOpenChange(false);
            onDeleted?.();
        },
        onError: (err: Error) => {
            if (err.message === 'folder.not_empty') {
                toast.error(t('delete_empty_only'));
            } else {
                toast.error(err.message);
            }
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete')}</DialogTitle>
                    <DialogDescription>{empty ? t('delete_confirm') : t('delete_empty_only')}</DialogDescription>
                </DialogHeader>
                {folder ? (
                    <div className='text-muted-foreground text-sm'>{folder.path || folder.name}</div>
                ) : null}
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        onClick={() => mutation.mutate()}
                        disabled={!empty || mutation.isPending}
                    >
                        {t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
