'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listUploads } from '@/lib/uploads/client';
import type { UploadAsset, UploadKind, UploaderMeta } from '@/lib/uploads/types';
import { FilesGrid } from '@/app/[locale]/(admin)/files/files-grid';

export interface FileLibraryPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Restrict the picker to one kind (image/cover/video). Matches the parent
     *  FileUploader's kind so a video-only field cannot accidentally embed an image. */
    kind: UploadKind;
    /** Called when the user picks an asset. Receives URL + matching meta so the
     *  parent can fill in mime/size without a re-upload. */
    onPick: (url: string, meta: UploaderMeta) => void;
}

/**
 * Dialog wrapper around <FilesGrid> in "select" mode. Lists existing uploads
 * filtered to one kind so the user can re-use a file without re-uploading.
 */
export function FileLibraryPicker({ open, onOpenChange, kind, onPick }: FileLibraryPickerProps) {
    const t = useTranslations('files');
    const [q, setQ] = useState('');

    const queryKey = useMemo(
        () => ['admin.uploads.list', { kind, q, page: 1, per_page: 24 }] as const,
        [kind, q],
    );

    const { data, isLoading } = useQuery({
        queryKey,
        queryFn: () => listUploads({ kind, q: q || undefined, page: 1, per_page: 24 }),
        enabled: open,
    });

    const rows: UploadAsset[] = data?.data ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-5xl'>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{t('search_placeholder')}</DialogDescription>
                </DialogHeader>
                <Input
                    placeholder={t('search_placeholder')}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className='mb-3'
                />
                <div className='max-h-[60vh] overflow-auto'>
                    <FilesGrid
                        rows={rows}
                        loading={isLoading}
                        hideDelete
                        onPick={(asset) => {
                            onPick(asset.file_url, {
                                mime: asset.mime,
                                size: asset.size,
                                original_name: asset.original_name,
                            });
                            onOpenChange(false);
                        }}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
