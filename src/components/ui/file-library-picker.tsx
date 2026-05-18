'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Upload, FolderPlus, Folder, ArrowUp } from 'lucide-react';
import type { FileFolder } from '@shared/folders';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FolderBreadcrumb } from '@/components/files/folder-breadcrumb';
import { CreateFolderDialog } from '@/components/files/create-folder-dialog';
import {
    findFolderById,
    getBreadcrumbs,
    useFolderTree,
} from '@/lib/folders/use-folder-tree';
import { listUploads } from '@/lib/uploads/client';
import { useFileUpload } from '@/lib/uploads/use-file-upload';
import { acceptForKind } from '@/lib/uploads/constants';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import type { UploadAsset, UploadKind, UploaderMeta } from '@/lib/uploads/types';

export interface FileLibraryPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Restrict the picker to one kind (image/cover/video). */
    kind: UploadKind;
    /** Folder to open by default (null = root). User can navigate from there. */
    defaultFolderId?: number | null;
    /** Whether to show the "Upload here" button. Defaults to true. */
    allowUpload?: boolean;
    /** Called when the user picks an asset. Receives URL + matching meta. */
    onPick: (url: string, meta: UploaderMeta) => void;
}

/**
 * Picker dialog — vertical-rows layout.
 * Toolbar (breadcrumb + actions) → folder cards (children of current) → file
 * grid → URL paste bar. Folder navigation uses breadcrumb + folder cards,
 * eliminating the previous left-sidebar tree to give files more horizontal
 * room.
 */
export function FileLibraryPicker({
    open,
    onOpenChange,
    kind,
    defaultFolderId,
    allowUpload = true,
    onPick,
}: FileLibraryPickerProps) {
    const t = useTranslations('files');
    const tFolders = useTranslations('files.folders');
    const tUpload = useTranslations('upload');
    const qc = useQueryClient();

    const [folderId, setFolderId] = useState<number | null>(defaultFolderId ?? null);
    const [q, setQ] = useState('');
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (open) {
            setFolderId(defaultFolderId ?? null);
            setQ('');
            setUrlInput('');
        }
    }, [open, defaultFolderId]);

    const urlIsValid = isValidUrl(urlInput);

    const foldersQuery = useFolderTree();
    const folders: FileFolder[] = foldersQuery.data ?? [];
    const currentFolder = useMemo(() => findFolderById(folders, folderId), [folders, folderId]);
    const breadcrumbs = useMemo(() => getBreadcrumbs(folders, folderId), [folders, folderId]);
    const childFolders = useMemo(
        () =>
            folders
                .filter((f) => (folderId === null ? f.parent_id === null : f.parent_id === folderId))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [folders, folderId],
    );

    const folderFilter: number | 'root' = folderId === null ? 'root' : folderId;

    const { data, isLoading } = useQuery({
        queryKey: ['admin.uploads.list', { kind, q, page: 1, per_page: 48, folder_id: folderFilter }] as const,
        queryFn: () =>
            listUploads({ kind, q: q || undefined, page: 1, per_page: 48, folder_id: folderFilter }),
        enabled: open,
    });

    const rows: UploadAsset[] = data?.data ?? [];

    const { state: uploadState, progress, upload } = useFileUpload({
        kind,
        folderId,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
        },
    });

    const onFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (file) upload(file);
    };

    const uploading = uploadState === 'requesting' || uploadState === 'uploading';

    const goUp = () => {
        if (folderId === null) return;
        const parent = currentFolder?.parent_id ?? null;
        setFolderId(parent);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='w-[95vw] sm:max-w-[1100px] max-h-[90dvh] overflow-hidden flex flex-col'>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{tFolders('picker_subtitle')}</DialogDescription>
                </DialogHeader>

                <div className='flex flex-col gap-3 overflow-hidden'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                onClick={goUp}
                                disabled={folderId === null}
                                aria-label={tFolders('root')}
                            >
                                <ArrowUp className='h-4 w-4' />
                            </Button>
                            <FolderBreadcrumb crumbs={breadcrumbs} onNavigate={setFolderId} />
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Input
                                placeholder={t('search_placeholder')}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className='h-9 w-48'
                            />
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => setCreateFolderOpen(true)}
                            >
                                <FolderPlus className='mr-1 h-4 w-4' />
                                {tFolders('new_folder')}
                            </Button>
                            {allowUpload ? (
                                <>
                                    <Button
                                        type='button'
                                        variant='default'
                                        size='sm'
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        <Upload className='mr-1 h-4 w-4' />
                                        {uploading ? `${progress}%` : tFolders('upload_here')}
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type='file'
                                        accept={acceptForKind(kind)}
                                        className='hidden'
                                        onChange={onFilesChosen}
                                    />
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className='min-h-0 flex-1 overflow-y-auto rounded-md border'>
                        {childFolders.length > 0 ? (
                            <div className='border-b bg-muted/30 p-3'>
                                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                                    {childFolders.map((f) => (
                                        <button
                                            type='button'
                                            key={f.id}
                                            onClick={() => setFolderId(f.id)}
                                            className='hover:bg-accent flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-sm transition-colors'
                                            title={f.path}
                                        >
                                            <Folder className='text-muted-foreground h-4 w-4 shrink-0' />
                                            <span className='truncate'>{f.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {isLoading ? (
                            <div className='text-muted-foreground p-6 text-sm'>{tUpload('uploading')}</div>
                        ) : rows.length === 0 ? (
                            <div className='text-muted-foreground p-6 text-sm'>{t('empty_state')}</div>
                        ) : (
                            <div className='grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'>
                                {rows.map((asset) => (
                                    <PickerFileCard
                                        key={asset.id}
                                        asset={asset}
                                        sizeLabel={t('size_mb', {
                                            mb: (asset.size / (1024 * 1024)).toFixed(1),
                                        })}
                                        onPick={() => {
                                            onPick(asset.file_url, {
                                                mime: asset.mime,
                                                size: asset.size,
                                                original_name: asset.original_name,
                                            });
                                            onOpenChange(false);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {uploading ? (
                        <div className='text-muted-foreground text-xs'>
                            {tUpload('progress', { pct: progress })}
                        </div>
                    ) : null}

                    <div className='flex flex-wrap items-center gap-2 border-t pt-3'>
                        <span className='text-muted-foreground shrink-0 text-xs'>
                            {t('or_paste_url_label')}
                        </span>
                        <Input
                            type='url'
                            placeholder='https://...'
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className='h-9 flex-1 min-w-[200px]'
                        />
                        <Button
                            type='button'
                            size='sm'
                            disabled={!urlIsValid}
                            onClick={() => {
                                onPick(urlInput.trim(), { mime: '', size: 0, original_name: null });
                                onOpenChange(false);
                            }}
                        >
                            {t('apply_url')}
                        </Button>
                    </div>
                </div>

                <CreateFolderDialog
                    open={createFolderOpen}
                    onOpenChange={setCreateFolderOpen}
                    parentId={folderId}
                    onCreated={(id) => setFolderId(id)}
                />
            </DialogContent>
        </Dialog>
    );
}

function PickerFileCard({
    asset,
    sizeLabel,
    onPick,
}: {
    asset: UploadAsset;
    sizeLabel: string;
    onPick: () => void;
}) {
    return (
        <button
            type='button'
            onClick={onPick}
            className='group hover:border-primary flex flex-col gap-1 rounded-md border bg-background p-1.5 text-left transition-colors'
            title={asset.original_name ?? asset.filename}
        >
            <div className='bg-muted aspect-square w-full overflow-hidden rounded'>
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
            <div className='truncate text-xs font-medium'>
                {asset.original_name ?? asset.filename}
            </div>
            <div className='text-muted-foreground text-[10px]'>{sizeLabel}</div>
        </button>
    );
}

function isValidUrl(s: string): boolean {
    const v = s.trim();
    if (v.length === 0) return false;
    try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}
