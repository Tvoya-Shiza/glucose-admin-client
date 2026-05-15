'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import type { UploadAsset } from '@/lib/uploads/types';

export interface FilesGridProps {
    rows: UploadAsset[];
    loading?: boolean;
    onPick?: (asset: UploadAsset) => void;
    onDelete?: (asset: UploadAsset) => void;
    /** Hide the delete action — used in picker mode where deletion is out of scope. */
    hideDelete?: boolean;
}

/**
 * Grid of upload thumbnails. Each card shows preview (image/video/icon),
 * metadata, and per-card actions: copy URL, pick (in picker mode), delete.
 *
 * Card preview rules:
 *   - image / cover → <img src=file_url>
 *   - video         → <video src=file_url controls preload="metadata">
 *   - unknown       → name + mime placeholder
 */
export function FilesGrid({ rows, loading, onPick, onDelete, hideDelete }: FilesGridProps) {
    const t = useTranslations('files');

    if (loading) {
        return (
            <div className='text-muted-foreground p-6 text-sm'>
                {useTranslations('upload')('uploading')}
            </div>
        );
    }

    const copyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(resolveAssetUrl(url));
            toast.success(t('copied'));
        } catch {
            toast.error(t('delete_failed'));
        }
    };

    return (
        <div className='grid grid-cols-2 gap-4 p-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {rows.map((asset) => (
                <div
                    key={asset.id}
                    className='flex flex-col gap-2 rounded-lg border p-2 text-sm'
                >
                    <div className='bg-muted text-muted-foreground flex h-32 w-full items-center justify-center overflow-hidden rounded'>
                        {asset.kind === 'video' ? (
                            <video
                                src={resolveAssetUrl(asset.file_url)}
                                className='h-full w-full bg-black object-cover'
                                preload='metadata'
                                muted
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={resolveAssetUrl(asset.file_url)}
                                alt={asset.original_name ?? ''}
                                className='h-full w-full object-cover'
                            />
                        )}
                    </div>
                    <div className='truncate font-medium' title={asset.original_name ?? asset.filename}>
                        {asset.original_name ?? asset.filename}
                    </div>
                    <div className='text-muted-foreground flex justify-between text-xs'>
                        <span>{asset.kind}</span>
                        <span>{t('size_mb', { mb: (asset.size / (1024 * 1024)).toFixed(1) })}</span>
                    </div>
                    <div className='flex flex-wrap gap-1'>
                        {onPick ? (
                            <Button
                                type='button'
                                variant='default'
                                size='sm'
                                onClick={() => onPick(asset)}
                            >
                                {t('copy_url')}
                            </Button>
                        ) : (
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => copyUrl(asset.file_url)}
                            >
                                {t('copy_url')}
                            </Button>
                        )}
                        {!hideDelete && onDelete ? (
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                onClick={() => onDelete(asset)}
                            >
                                {t('delete')}
                            </Button>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
