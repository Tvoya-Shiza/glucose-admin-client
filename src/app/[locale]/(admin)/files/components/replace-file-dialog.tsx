'use client';

import { useRef, useState } from 'react';
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
import { replaceUpload } from '@/lib/uploads/client';
import { mapUploadErrorToI18nKey } from '@/lib/uploads/errors';
import type { UploadAsset } from '@/lib/uploads/types';

export interface ReplaceFileDialogProps {
    asset: UploadAsset | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Replace a file's content in place. The picker is constrained to the asset's
 * own MIME so the URL stays identical (server enforces this too). Shows upload
 * progress; on success the list refreshes (same file_url, new bytes/size).
 */
export function ReplaceFileDialog({ asset, open, onOpenChange }: ReplaceFileDialogProps) {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');
    const qc = useQueryClient();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [progress, setProgress] = useState(0);

    const mutation = useMutation({
        mutationFn: async (file: File) => {
            if (!asset) throw new Error('upload.asset_not_found');
            setProgress(0);
            return replaceUpload({ id: asset.id, kind: asset.kind, mime: asset.mime }, file, setProgress);
        },
        onSuccess: () => {
            toast.success(t('replace_succeeded'));
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            const key = mapUploadErrorToI18nKey(err.message).replace(/^upload\./, '');
            toast.error(tUpload(key));
        },
    });

    const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (inputRef.current) inputRef.current.value = '';
        if (file) mutation.mutate(file);
    };

    const busy = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('replace_title')}</DialogTitle>
                    <DialogDescription>{t('replace_body')}</DialogDescription>
                </DialogHeader>
                {asset ? (
                    <div className='min-w-0 break-all text-muted-foreground text-sm'>
                        {asset.original_name ?? asset.filename} · {asset.mime}
                    </div>
                ) : null}
                <input
                    ref={inputRef}
                    type='file'
                    accept={asset?.mime}
                    className='hidden'
                    onChange={onPick}
                />
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={busy}>
                        {t('cancel')}
                    </Button>
                    <Button type='button' onClick={() => inputRef.current?.click()} disabled={busy}>
                        {busy ? `${progress}%` : t('replace_pick')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
