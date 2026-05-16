'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Upload, FolderPlus } from 'lucide-react';
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
import { FolderTree } from '@/components/files/folder-tree';
import { CreateFolderDialog } from '@/components/files/create-folder-dialog';
import {
    buildFolderTree,
    findFolderById,
    getBreadcrumbs,
    useFolderTree,
} from '@/lib/folders/use-folder-tree';
import { listUploads } from '@/lib/uploads/client';
import { useFileUpload } from '@/lib/uploads/use-file-upload';
import { acceptForKind } from '@/lib/uploads/constants';
import type { UploadAsset, UploadKind, UploaderMeta } from '@/lib/uploads/types';
import { FilesGrid } from '@/app/[locale]/(admin)/files/files-grid';

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
 * Picker dialog with a folder tree on the left and a grid on the right.
 * The "Upload here" button is wired to the current folder so the user can
 * fill a course-cover slot without leaving the picker context.
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Reset when reopened so a stale folder selection from a previous open
    // doesn't bleed into the new session.
    useEffect(() => {
        if (open) {
            setFolderId(defaultFolderId ?? null);
            setQ('');
        }
    }, [open, defaultFolderId]);

    const foldersQuery = useFolderTree();
    const folders: FileFolder[] = foldersQuery.data ?? [];
    const tree = useMemo(() => buildFolderTree(folders), [folders]);
    const currentFolder = useMemo(() => findFolderById(folders, folderId), [folders, folderId]);
    const breadcrumbs = useMemo(() => getBreadcrumbs(folders, folderId), [folders, folderId]);

    const folderFilter: number | 'root' = folderId === null ? 'root' : folderId;

    const { data, isLoading } = useQuery({
        queryKey: ['admin.uploads.list', { kind, q, page: 1, per_page: 24, folder_id: folderFilter }] as const,
        queryFn: () =>
            listUploads({ kind, q: q || undefined, page: 1, per_page: 24, folder_id: folderFilter }),
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-6xl'>
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>{tFolders('picker_subtitle')}</DialogDescription>
                </DialogHeader>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]'>
                    <div className='border-r pr-2'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            className='mb-2 w-full'
                            onClick={() => setCreateFolderOpen(true)}
                        >
                            <FolderPlus className='mr-1 h-4 w-4' />
                            {tFolders('new_folder')}
                        </Button>
                        <div className='max-h-[60vh] overflow-y-auto'>
                            <FolderTree nodes={tree} selectedId={folderId} onSelect={setFolderId} />
                        </div>
                    </div>

                    <div className='flex flex-col gap-2'>
                        <FolderBreadcrumb crumbs={breadcrumbs} onNavigate={setFolderId} />

                        <div className='flex flex-wrap items-center gap-2'>
                            <Input
                                placeholder={t('search_placeholder')}
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className='w-64'
                            />
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
                            {currentFolder ? (
                                <span className='text-muted-foreground text-xs'>{currentFolder.path}</span>
                            ) : null}
                        </div>

                        <div className='max-h-[55vh] overflow-auto'>
                            {!isLoading && rows.length === 0 ? (
                                <div className='text-muted-foreground p-6 text-sm'>{t('empty_state')}</div>
                            ) : (
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
                            )}
                        </div>
                        {uploading ? (
                            <div className='text-muted-foreground text-xs'>
                                {tUpload('progress', { pct: progress })}
                            </div>
                        ) : null}
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
