'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Building2 } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/lib/access/use-permission';
import { listPublishers } from '@/lib/ebooks/api';
import type { PublisherRow } from '@/lib/ebooks/types';
import { DeletePublisherDialog } from './components/delete-publisher-dialog';
import { UpsertPublisherDialog } from './components/upsert-publisher-dialog';
import { PublishersTable } from './publishers-table';

/**
 * Phase 39/40 — «Баспалар» (publishers) reference-table manager.
 *
 * Full CRUD over GET/POST/PATCH/DELETE /publishers with the same nuqs + TanStack
 * Query + dialog conventions as the ebooks list. Publishers have NO permission
 * group of their own: read is `ebooks.view` (already enforced by the /ebooks
 * route mapping), every mutation is `ebooks.edit`.
 */
export function PublishersListClient() {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();

    const [{ page, page_size, q }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
    });

    const canEdit = usePermission('ebooks.edit');

    const [qLocal, setQLocal] = useState(q ?? '');
    useEffect(() => {
        const id = setTimeout(() => {
            if ((q ?? '') !== qLocal) setQ({ page: 1, q: qLocal || null });
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    const queryKey = useMemo(() => ['admin.publishers.list', { page, page_size, q }] as const, [page, page_size, q]);

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () => listPublishers({ page, page_size, q: q ?? undefined }),
        placeholderData: (prev) => prev,
    });

    const rows: PublisherRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editRow, setEditRow] = useState<PublisherRow | null>(null);
    const [deleteRow, setDeleteRow] = useState<PublisherRow | null>(null);

    const emptyTitle = q && q.trim().length > 0 ? t('empty_no_results') : t('publishers_empty');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('publishers_title')}
                    subtitle={t('publishers_subtitle')}
                    breadcrumbs={[{ label: t('list_title'), href: `/${locale}/ebooks` }, { label: t('publishers_title') }]}
                    actions={
                        canEdit ? (
                            <Button
                                onClick={() => {
                                    setEditRow(null);
                                    setUpsertOpen(true);
                                }}
                            >
                                {t('publisher_create')}
                            </Button>
                        ) : null
                    }
                />
            }
            footer={
                rows.length > 0 || page > 1 ? (
                    <DataTablePagination
                        page={page}
                        pageSize={page_size}
                        total={total}
                        rowCount={rows.length}
                        isFetching={isFetching}
                        onPageChange={(p) => setQ({ page: p })}
                        onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                    />
                ) : null
            }
            contentClassName='space-y-4'
        >
            <Card className='p-4'>
                <div className='flex flex-wrap items-center gap-3 border-b p-4'>
                    <Input
                        className='max-w-sm'
                        placeholder={t('publishers_search_placeholder')}
                        value={qLocal}
                        onChange={(e) => setQLocal(e.target.value)}
                    />
                </div>
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Building2} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Building2} title={emptyTitle} />
                ) : (
                    <PublishersTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        onEdit={(row) => {
                            setEditRow(row);
                            setUpsertOpen(true);
                        }}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </Card>

            {canEdit ? (
                <>
                    <UpsertPublisherDialog
                        open={upsertOpen}
                        onOpenChange={(o) => {
                            setUpsertOpen(o);
                            if (!o) setEditRow(null);
                        }}
                        publisher={editRow}
                    />
                    <DeletePublisherDialog
                        open={deleteRow !== null}
                        onOpenChange={(o) => {
                            if (!o) setDeleteRow(null);
                        }}
                        publisher={deleteRow}
                    />
                </>
            ) : null}
        </PageShell>
    );
}
