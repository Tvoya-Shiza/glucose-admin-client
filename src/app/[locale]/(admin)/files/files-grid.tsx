'use client';

import { useTranslations } from 'next-intl';
import { useDraggable } from '@dnd-kit/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import type { UploadAsset } from '@/lib/uploads/types';

export interface FilesGridProps {
    rows: UploadAsset[];
    loading?: boolean;
    onPick?: (asset: UploadAsset) => void;
    onDelete?: (asset: UploadAsset) => void;
    /** Edit the display name. Omitted in picker mode. */
    onRename?: (asset: UploadAsset) => void;
    /** Replace the file content in place (same URL). Omitted in picker mode. */
    onReplace?: (asset: UploadAsset) => void;
    /** Hide the delete action — used in picker mode where deletion is out of scope. */
    hideDelete?: boolean;
    /** Make each card draggable (used on /files for move-to-folder). Requires an
     *  enclosing DndContext to receive the drag events. */
    draggable?: boolean;
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
export function FilesGrid({ rows, loading, onPick, onDelete, onRename, onReplace, hideDelete, draggable }: FilesGridProps) {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');

    if (loading) {
        return (
            <div className='text-muted-foreground p-6 text-sm'>
                {tUpload('uploading')}
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
            {rows.map((asset) =>
                draggable ? (
                    <DraggableFileCard
                        key={asset.id}
                        asset={asset}
                        onPick={onPick}
                        onDelete={onDelete}
                        onRename={onRename}
                        onReplace={onReplace}
                        hideDelete={hideDelete}
                        copyUrl={copyUrl}
                        labelKind={asset.kind}
                        sizeLabel={t('size_mb', { mb: (asset.size / (1024 * 1024)).toFixed(1) })}
                        copyText={t('copy_url')}
                        deleteText={t('delete')}
                        renameText={t('rename')}
                        replaceText={t('replace')}
                    />
                ) : (
                    <FileCardBody
                        key={asset.id}
                        asset={asset}
                        onPick={onPick}
                        onDelete={onDelete}
                        onRename={onRename}
                        onReplace={onReplace}
                        hideDelete={hideDelete}
                        copyUrl={copyUrl}
                        sizeLabel={t('size_mb', { mb: (asset.size / (1024 * 1024)).toFixed(1) })}
                        copyText={t('copy_url')}
                        deleteText={t('delete')}
                        renameText={t('rename')}
                        replaceText={t('replace')}
                    />
                ),
            )}
        </div>
    );
}

interface CardCommonProps {
    asset: UploadAsset;
    onPick?: (asset: UploadAsset) => void;
    onDelete?: (asset: UploadAsset) => void;
    onRename?: (asset: UploadAsset) => void;
    onReplace?: (asset: UploadAsset) => void;
    hideDelete?: boolean;
    copyUrl: (url: string) => Promise<void>;
    sizeLabel: string;
    copyText: string;
    deleteText: string;
    renameText: string;
    replaceText: string;
}

function FileCardBody({
    asset,
    onPick,
    onDelete,
    onRename,
    onReplace,
    hideDelete,
    copyUrl,
    sizeLabel,
    copyText,
    deleteText,
    renameText,
    replaceText,
}: CardCommonProps) {
    return (
        <div className='flex flex-col gap-2 rounded-lg border p-2 text-sm'>
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
                <span>{sizeLabel}</span>
            </div>
            <div className='flex flex-wrap gap-1'>
                {onPick ? (
                    <Button type='button' variant='default' size='sm' onClick={() => onPick(asset)}>
                        {copyText}
                    </Button>
                ) : (
                    <Button type='button' variant='outline' size='sm' onClick={() => copyUrl(asset.file_url)}>
                        {copyText}
                    </Button>
                )}
                {onRename ? (
                    <Button type='button' variant='outline' size='sm' onClick={() => onRename(asset)}>
                        {renameText}
                    </Button>
                ) : null}
                {onReplace ? (
                    <Button type='button' variant='outline' size='sm' onClick={() => onReplace(asset)}>
                        {replaceText}
                    </Button>
                ) : null}
                {!hideDelete && onDelete ? (
                    <Button type='button' variant='ghost' size='sm' onClick={() => onDelete(asset)}>
                        {deleteText}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function DraggableFileCard(props: CardCommonProps & { labelKind: string }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `file-${props.asset.id}`,
        data: { type: 'file', uploadId: props.asset.id },
    });
    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={cn('cursor-grab touch-none', isDragging ? 'opacity-40' : '')}
        >
            <FileCardBody {...props} />
        </div>
    );
}
