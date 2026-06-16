'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renameUpload } from '@/lib/uploads/client';
import { mapUploadErrorToI18nKey } from '@/lib/uploads/errors';
import type { UploadAsset } from '@/lib/uploads/types';

export interface RenameFileDialogProps {
    asset: UploadAsset | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Rename a file's display name (`original_name`). The ULID filename + file_url
 * are immutable, so this never breaks a reference — purely a metadata edit.
 */
export function RenameFileDialog({ asset, open, onOpenChange }: RenameFileDialogProps) {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');
    const qc = useQueryClient();
    const [name, setName] = useState('');

    useEffect(() => {
        if (open && asset) setName(asset.original_name ?? asset.filename);
    }, [open, asset]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!asset) throw new Error('upload.asset_not_found');
            return renameUpload(asset.id, { original_name: name.trim() });
        },
        onSuccess: () => {
            toast.success(t('rename_succeeded'));
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            const key = mapUploadErrorToI18nKey(err.message).replace(/^upload\./, '');
            toast.error(tUpload(key));
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('rename_title')}</DialogTitle>
                </DialogHeader>
                <div className='space-y-1.5'>
                    <Label htmlFor='rename-file-input'>{t('rename_label')}</Label>
                    <Input
                        id='rename-file-input'
                        value={name}
                        maxLength={120}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending || name.trim().length === 0}
                    >
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
