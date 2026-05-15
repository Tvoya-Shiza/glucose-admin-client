'use client';

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
import { deleteUpload } from '@/lib/uploads/client';
import { mapUploadErrorToI18nKey } from '@/lib/uploads/errors';
import type { UploadAsset } from '@/lib/uploads/types';

export interface DeleteFileDialogProps {
    asset: UploadAsset | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Soft-delete confirmation. The body explains the link-tracking caveat
 * (Phase 5+ does not check whether banners/courses/stories/blogs still
 * reference the file) — users see a warning before clicking confirm.
 */
export function DeleteFileDialog({ asset, open, onOpenChange }: DeleteFileDialogProps) {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            if (!asset) throw new Error('upload.asset_not_found');
            return deleteUpload(asset.id);
        },
        onSuccess: () => {
            toast.success(t('delete_succeeded'));
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
                    <DialogTitle>{t('delete_confirm_title')}</DialogTitle>
                    <DialogDescription>{t('delete_confirm_body')}</DialogDescription>
                </DialogHeader>
                {asset ? (
                    <div className='text-muted-foreground text-sm'>
                        {asset.original_name ?? asset.filename}
                    </div>
                ) : null}
                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        {tUpload('clear')}
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                    >
                        {t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
