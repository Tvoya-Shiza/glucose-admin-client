'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
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
        <PageShell
            header={<PageHeader title={t('title')} />}
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
            <Card className='p-4'>
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
                <FilesGrid rows={rows} loading={isLoading} onDelete={(asset) => setDeleteAsset(asset)} />
            )}

            <DeleteFileDialog
                asset={deleteAsset}
                open={deleteAsset !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteAsset(null);
                }}
            />
        </PageShell>
    );
}
