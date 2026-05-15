'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { EmptyState } from '@/components/users/empty-state';
import { Button } from '@/components/ui/button';
import { listUploads } from '@/lib/uploads/client';
import type { UploadAsset, UploadKind } from '@/lib/uploads/types';
import { DeleteFileDialog } from './components/delete-file-dialog';
import { FilesFilters } from './files-filters';
import { FilesGrid } from './files-grid';

/**
 * File library list page. Lists every row in `upload_assets` (Phase 5+ Upload
 * registry). Soft-deleted rows are hidden by the server.
 *
 * URL state via nuqs: page, kind, q, mine. Filter changes reset page=1.
 *
 * Role gates:
 *   - GET endpoint is open to admin/teacher/curator.
 *   - DELETE is admin/teacher only (server enforces; the delete button shows
 *     for everyone and only fails late for curator, but curators rarely
 *     reach this page).
 */
export function FilesListClient() {
    const t = useTranslations('files');
    const tUpload = useTranslations('upload');

    const [{ page, per_page, kind, q, mine }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        per_page: parseAsInteger.withDefault(24),
        kind: parseAsString,
        q: parseAsString,
        mine: parseAsBoolean,
    });

    const queryKey = useMemo(
        () => ['admin.uploads.list', { page, per_page, kind, q, mine }] as const,
        [page, per_page, kind, q, mine],
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
            }),
        placeholderData: (prev) => prev,
    });

    const rows: UploadAsset[] = data?.data ?? [];
    const total = data?.meta.total ?? 0;

    const [deleteAsset, setDeleteAsset] = useState<UploadAsset | null>(null);

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('title')}</h1>
                </div>
            </header>

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

            <div className='flex-1 overflow-auto'>
                {error ? (
                    <EmptyState title={tUpload('failed')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState title={t('empty_state')} />
                ) : (
                    <FilesGrid
                        rows={rows}
                        loading={isLoading}
                        onDelete={(asset) => setDeleteAsset(asset)}
                    />
                )}
            </div>

            <footer className='flex items-center justify-between border-t p-4 text-sm'>
                <span className='text-muted-foreground'>
                    {isFetching ? tUpload('uploading') : total}
                </span>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => setQ({ page: page - 1 })}
                    >
                        ‹
                    </Button>
                    <span className='tabular-nums'>{page}</span>
                    <Button
                        variant='outline'
                        size='sm'
                        disabled={rows.length < per_page}
                        onClick={() => setQ({ page: page + 1 })}
                    >
                        ›
                    </Button>
                </div>
            </footer>

            <DeleteFileDialog
                asset={deleteAsset}
                open={deleteAsset !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteAsset(null);
                }}
            />
        </div>
    );
}
