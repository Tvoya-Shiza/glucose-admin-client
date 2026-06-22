'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { FolderOpen, FolderPlus, MoreHorizontal, Trash2, Pencil, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { FileFolder } from '@shared/folders';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderBreadcrumb } from '@/components/files/folder-breadcrumb';
import { FolderTree } from '@/components/files/folder-tree';
import { CreateFolderDialog } from '@/components/files/create-folder-dialog';
import { RenameFolderDialog } from '@/components/files/rename-folder-dialog';
import { DeleteFolderDialog } from '@/components/files/delete-folder-dialog';
import {
    buildFolderTree,
    findFolderById,
    getBreadcrumbs,
    useFolderTree,
} from '@/lib/folders/use-folder-tree';
import { listUploads, moveUpload } from '@/lib/uploads/client';
import { useFileUpload } from '@/lib/uploads/use-file-upload';
import { MIME_BY_KIND } from '@/lib/uploads/constants';
import { mapUploadErrorToI18nKey } from '@/lib/uploads/errors';
import type { UploadAsset, UploadKind } from '@/lib/uploads/types';
import { DeleteFileDialog } from './components/delete-file-dialog';
import { RenameFileDialog } from './components/rename-file-dialog';
import { ReplaceFileDialog } from './components/replace-file-dialog';
import { FilesFilters } from './files-filters';
import { FilesGrid } from './files-grid';

/**
 * File library page (Phase 10 — folder-aware).
 *
 * Layout: 2-column grid (260px sidebar + flex content). Sidebar holds the
 * folder tree + management buttons; content holds breadcrumbs, filters,
 * and the grid of files in the current folder.
 *
 * URL state via nuqs: page, kind, q, mine, folder. Filter changes reset page=1.
 *
 * DnD: each card is a draggable, each tree row is a droppable. Dropping a file
 * on a folder calls PATCH /uploads/:id/move which performs DB+disk rename in one
 * transaction.
 */
export function FilesListClient() {
    const t = useTranslations('files');
    const tFolders = useTranslations('files.folders');
    const tUpload = useTranslations('upload');
    const qc = useQueryClient();

    const [{ page, per_page, kind, q, mine, folder }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        per_page: parseAsInteger.withDefault(24),
        kind: parseAsString,
        q: parseAsString,
        mine: parseAsBoolean,
        folder: parseAsInteger,
    });

    const folderId: number | null = folder;
    const folderFilter: number | 'root' = folderId === null ? 'root' : folderId;

    const queryKey = useMemo(
        () => ['admin.uploads.list', { page, per_page, kind, q, mine, folder_id: folderFilter }] as const,
        [page, per_page, kind, q, mine, folderFilter],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listUploads({
                page,
                per_page,
                kind: (kind as UploadKind | null) ?? undefined,
                q: q ?? undefined,
                mine: mine ?? undefined,
                folder_id: folderFilter,
            }),
        placeholderData: (prev) => prev,
    });

    const foldersQuery = useFolderTree();
    const folders: FileFolder[] = foldersQuery.data ?? [];
    const tree = useMemo(() => buildFolderTree(folders), [folders]);
    const currentFolder = useMemo(() => findFolderById(folders, folderId), [folders, folderId]);
    const breadcrumbs = useMemo(() => getBreadcrumbs(folders, folderId), [folders, folderId]);

    const rows: UploadAsset[] = data?.data ?? [];
    const total = data?.meta.total ?? 0;

    const [deleteAsset, setDeleteAsset] = useState<UploadAsset | null>(null);
    const [renameAsset, setRenameAsset] = useState<UploadAsset | null>(null);
    const [replaceAsset, setReplaceAsset] = useState<UploadAsset | null>(null);
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
    const [activeDrag, setActiveDrag] = useState(false);

    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const onUploadSuccess = () => {
        toast.success(tUpload('succeeded'));
        qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
    };
    const onUploadError = (i18nKey: string) => {
        toast.error(tUpload(i18nKey.replace(/^upload\./, '')));
    };

    const imageUploader = useFileUpload({ kind: 'image', folderId, onSuccess: onUploadSuccess, onError: onUploadError });
    const coverUploader = useFileUpload({ kind: 'cover', folderId, onSuccess: onUploadSuccess, onError: onUploadError });
    const videoUploader = useFileUpload({ kind: 'video', folderId, onSuccess: onUploadSuccess, onError: onUploadError });
    const documentUploader = useFileUpload({ kind: 'document', folderId, onSuccess: onUploadSuccess, onError: onUploadError });

    const inflightUploader =
        videoUploader.state === 'requesting' || videoUploader.state === 'uploading'
            ? videoUploader
            : documentUploader.state === 'requesting' || documentUploader.state === 'uploading'
              ? documentUploader
              : coverUploader.state === 'requesting' || coverUploader.state === 'uploading'
                ? coverUploader
                : null;
    const activeUploader = inflightUploader ?? imageUploader;
    const uploading = inflightUploader !== null;

    const handleUploadPick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (uploadInputRef.current) uploadInputRef.current.value = '';
        if (!file) return;
        if (file.type.startsWith('video/')) {
            videoUploader.upload(file);
            return;
        }
        // Documents (PDF / Office / txt / zip) route to the document uploader —
        // the image/cover whitelists would otherwise reject them at pre-flight.
        if ((MIME_BY_KIND.document as ReadonlyArray<string>).includes(file.type)) {
            documentUploader.upload(file);
            return;
        }
        // Respect the current kind filter for images: if user is browsing
        // covers, save as cover. Otherwise default to image.
        if (kind === 'cover') {
            coverUploader.upload(file);
        } else {
            imageUploader.upload(file);
        }
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const moveMutation = useMutation({
        mutationFn: ({ id, target }: { id: string; target: number | null }) =>
            moveUpload(id, { folder_id: target }),
        onSuccess: () => {
            toast.success(tFolders('moved'));
            qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
        },
        onError: (err: Error) => {
            const key = mapUploadErrorToI18nKey(err.message).replace(/^upload\./, '');
            toast.error(tUpload(key));
        },
    });

    const onDragEnd = (event: DragEndEvent) => {
        setActiveDrag(false);
        const { active, over } = event;
        if (!over || !active.data.current || !over.data.current) return;
        if (active.data.current.type !== 'file' || over.data.current.type !== 'folder') return;
        const uploadId = String(active.data.current.uploadId);
        const targetFolderId = over.data.current.folderId as number | null;
        moveMutation.mutate({ id: uploadId, target: targetFolderId });
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={() => setActiveDrag(true)}
            onDragCancel={() => setActiveDrag(false)}
            onDragEnd={onDragEnd}
        >
            <PageShell
                header={
                    <PageHeader
                        title={t('title')}
                        actions={
                            <div className='flex flex-wrap items-center gap-2'>
                                <Button type='button' variant='outline' onClick={() => setCreateFolderOpen(true)}>
                                    <FolderPlus className='mr-1 h-4 w-4' />
                                    {tFolders('new_folder')}
                                </Button>
                                <Button
                                    type='button'
                                    variant='default'
                                    onClick={() => uploadInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    <Upload className='mr-1 h-4 w-4' />
                                    {uploading ? `${activeUploader.progress}%` : tFolders('upload_here')}
                                </Button>
                                <input
                                    ref={uploadInputRef}
                                    type='file'
                                    accept={[
                                        ...(MIME_BY_KIND.image as ReadonlyArray<string>),
                                        ...(MIME_BY_KIND.video as ReadonlyArray<string>),
                                        ...(MIME_BY_KIND.document as ReadonlyArray<string>),
                                    ].join(',')}
                                    className='hidden'
                                    onChange={handleUploadPick}
                                />
                            </div>
                        }
                    />
                }
                footer={
                    rows.length > 0 || page > 1 ? (
                        <DataTablePagination
                            page={page}
                            pageSize={per_page}
                            total={total}
                            rowCount={rows.length}
                            isFetching={isFetching}
                            pageSizeOptions={[12, 24, 48, 96]}
                            onPageChange={(p) => setQ({ page: p })}
                            onPageSizeChange={(size) => setQ({ page: 1, per_page: size })}
                        />
                    ) : null
                }
                contentClassName='space-y-4'
            >
                <div className='grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]'>
                    <Card className='h-fit p-3'>
                        <FolderTree
                            nodes={tree}
                            selectedId={folderId}
                            onSelect={(id) => setQ({ folder: id, page: 1 })}
                            dropEnabled={activeDrag}
                        />
                    </Card>

                    <div className='space-y-3'>
                        <Card className='p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <FolderBreadcrumb crumbs={breadcrumbs} onNavigate={(id) => setQ({ folder: id, page: 1 })} />
                                {currentFolder ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type='button' variant='ghost' size='sm'>
                                                <MoreHorizontal className='h-4 w-4' />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align='end'>
                                            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                                                <Pencil className='mr-2 h-4 w-4' />
                                                {tFolders('rename')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDeleteFolderOpen(true)}>
                                                <Trash2 className='mr-2 h-4 w-4' />
                                                {tFolders('delete')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : null}
                            </div>
                        </Card>

                        <Card className='p-2'>
                            <FilesFilters
                                value={{ kind: (kind as UploadKind | null) ?? null, q, mine }}
                                onChange={(next) =>
                                    setQ({
                                        page: 1,
                                        kind: next.kind ?? null,
                                        q: next.q ?? null,
                                        mine: next.mine ?? null,
                                    })
                                }
                            />
                        </Card>

                        {error ? (
                            <EmptyState icon={FolderOpen} title={tUpload('failed')} subtitle={(error as Error).message} />
                        ) : !isLoading && rows.length === 0 ? (
                            <EmptyState icon={FolderOpen} title={t('empty_state')} />
                        ) : (
                            <FilesGrid
                                rows={rows}
                                loading={isLoading}
                                draggable
                                onDelete={(asset) => setDeleteAsset(asset)}
                                onRename={(asset) => setRenameAsset(asset)}
                                onReplace={(asset) => setReplaceAsset(asset)}
                            />
                        )}
                    </div>
                </div>

                <DeleteFileDialog
                    asset={deleteAsset}
                    open={deleteAsset !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteAsset(null);
                    }}
                />
                <RenameFileDialog
                    asset={renameAsset}
                    open={renameAsset !== null}
                    onOpenChange={(o) => {
                        if (!o) setRenameAsset(null);
                    }}
                />
                <ReplaceFileDialog
                    asset={replaceAsset}
                    open={replaceAsset !== null}
                    onOpenChange={(o) => {
                        if (!o) setReplaceAsset(null);
                    }}
                />
                <CreateFolderDialog
                    open={createFolderOpen}
                    onOpenChange={setCreateFolderOpen}
                    parentId={folderId}
                    onCreated={(id) => setQ({ folder: id, page: 1 })}
                />
                <RenameFolderDialog open={renameOpen} onOpenChange={setRenameOpen} folder={currentFolder} />
                <DeleteFolderDialog
                    open={deleteFolderOpen}
                    onOpenChange={setDeleteFolderOpen}
                    folder={currentFolder}
                    onDeleted={() => setQ({ folder: currentFolder?.parent_id ?? null, page: 1 })}
                />
            </PageShell>
        </DndContext>
    );
}
