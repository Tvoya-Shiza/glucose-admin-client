'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Check, FolderOpen, FolderPlus, MoreHorizontal, Trash2, Pencil, Upload, X } from 'lucide-react';
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
import { useMultiFileUpload, type MultiUploadItem } from '@/lib/uploads/use-multi-file-upload';
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

    // Route each picked file to an upload kind. Mirrors the single-file rules:
    // videos → video; PDF/Office/txt/zip → document (the image/cover whitelists
    // would reject them); otherwise save as cover when browsing covers, else image.
    const resolveKind = useCallback(
        (file: File): UploadKind => {
            if (file.type.startsWith('video/')) return 'video';
            if ((MIME_BY_KIND.document as ReadonlyArray<string>).includes(file.type)) return 'document';
            return kind === 'cover' ? 'cover' : 'image';
        },
        [kind],
    );

    const { items, active: uploading, overallProgress, enqueue, clear: clearUploads } = useMultiFileUpload({
        folderId,
        resolveKind,
        onSettled: (settled) => {
            const ok = settled.filter((it) => it.state === 'done').length;
            const failed = settled.filter((it) => it.state === 'error').length;
            if (ok > 0) qc.invalidateQueries({ queryKey: ['admin.uploads.list'] });
            if (failed === 0) {
                toast.success(t('upload_summary_success', { count: ok }));
            } else if (ok > 0) {
                toast.error(t('upload_summary_partial', { ok, failed }));
            } else {
                toast.error(tUpload('failed'));
            }
        },
    });

    const handleUploadPick = (event: React.ChangeEvent<HTMLInputElement>) => {
        // Copy out of the live FileList BEFORE resetting input.value — clearing the
        // input empties event.target.files in place, so reading length afterwards
        // would always see 0 and silently drop the picked files.
        const files = Array.from(event.target.files ?? []);
        if (uploadInputRef.current) uploadInputRef.current.value = '';
        if (files.length === 0) return;
        enqueue(files);
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
                                    {uploading ? `${overallProgress}%` : tFolders('upload_here')}
                                </Button>
                                <input
                                    ref={uploadInputRef}
                                    type='file'
                                    multiple
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

                        {items.length > 0 ? (
                            <UploadQueueCard items={items} active={uploading} onDismiss={clearUploads} />
                        ) : null}

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

/**
 * Compact progress panel for a batch upload. Shows one row per file with its
 * live progress / final status. Dismiss is offered only once the batch has
 * settled (no in-flight uploads), so completed results stay visible until the
 * user clears them.
 */
function UploadQueueCard({
    items,
    active,
    onDismiss,
}: {
    items: MultiUploadItem[];
    active: boolean;
    onDismiss: () => void;
}) {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');
    const done = items.filter((it) => it.state === 'done').length;

    return (
        <Card className='space-y-2 p-3'>
            <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-medium'>
                    {t('upload_queue_title')} ({done}/{items.length})
                </span>
                {!active ? (
                    <Button type='button' variant='ghost' size='sm' onClick={onDismiss}>
                        <X className='mr-1 h-4 w-4' />
                        {t('upload_dismiss')}
                    </Button>
                ) : null}
            </div>
            <ul className='space-y-1.5'>
                {items.map((it) => (
                    <li key={it.id} className='flex items-center gap-3 text-sm'>
                        <span className='min-w-0 flex-1 truncate' title={it.file.name}>
                            {it.file.name}
                        </span>
                        <div className='flex w-40 shrink-0 items-center justify-end gap-2'>
                            {it.state === 'idle' ? (
                                <span className='text-muted-foreground text-xs'>{t('upload_queued')}</span>
                            ) : null}
                            {it.state === 'requesting' || it.state === 'uploading' ? (
                                <>
                                    <div className='bg-muted h-2 w-24 overflow-hidden rounded'>
                                        <div
                                            className='bg-primary h-full transition-[width] duration-150'
                                            style={{ width: `${it.progress}%` }}
                                            role='progressbar'
                                            aria-valuenow={it.progress}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        />
                                    </div>
                                    <span className='text-muted-foreground w-9 text-right text-xs tabular-nums'>{it.progress}%</span>
                                </>
                            ) : null}
                            {it.state === 'done' ? (
                                <span className='flex items-center gap-1 text-xs text-emerald-600'>
                                    <Check className='h-4 w-4' />
                                    {t('upload_done')}
                                </span>
                            ) : null}
                            {it.state === 'error' ? (
                                <span
                                    className='text-destructive flex items-center gap-1 text-right text-xs'
                                    title={it.error ? tUpload(it.error.i18nKey.replace(/^upload\./, '')) : undefined}
                                >
                                    <X className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>
                                        {it.error ? tUpload(it.error.i18nKey.replace(/^upload\./, '')) : tUpload('failed')}
                                    </span>
                                </span>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
