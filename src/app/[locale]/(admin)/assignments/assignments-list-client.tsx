'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { listAssignments } from '@/lib/assignments/api';
import type { AssignmentRow, AssignmentSortField, AssignmentStatus, SortOrder } from '@/lib/assignments/types';
import { AssignmentsDashboard } from './assignments-dashboard';
import { AssignmentsFilters } from './assignments-filters';
import { AssignmentsTable } from './assignments-table';
import { UpsertAssignmentDialog } from './components/upsert-assignment-dialog';
import { DeleteAssignmentDialog } from './components/delete-assignment-dialog';

export function AssignmentsListClient() {
    const t = useTranslations('admin.assignments');

    const [{ page, page_size, status, webinar_id, q, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        webinar_id: parseAsInteger,
        q: parseAsString,
        sort: parseAsString.withDefault('created_at'),
        order: parseAsString.withDefault('desc'),
    });

    const canCreate = usePermission('assignments.create');
    const canEdit = usePermission('assignments.edit');
    const canDelete = usePermission('assignments.delete');

    const queryKey = useMemo(
        () => ['admin.assignments.list', { page, page_size, status, webinar_id, q, sort, order }] as const,
        [page, page_size, status, webinar_id, q, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listAssignments({
                page,
                page_size,
                status: (status as AssignmentStatus | null) ?? undefined,
                webinar_id: webinar_id ?? undefined,
                q: q ?? undefined,
                sort: sort as AssignmentSortField,
                order: order as SortOrder,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: AssignmentRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(status || webinar_id || (q && q.trim().length > 0));

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editRow, setEditRow] = useState<AssignmentRow | null>(null);
    const [deleteRow, setDeleteRow] = useState<AssignmentRow | null>(null);

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={canCreate ? <Button onClick={() => setUpsertOpen(true)}>{t('create')}</Button> : null}
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
            <AssignmentsDashboard />

            <Card className='p-4'>
                <AssignmentsFilters
                    value={{
                        q: q ?? undefined,
                        status: (status as AssignmentStatus | null) ?? undefined,
                        webinar_id: webinar_id ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            status: next.status ?? null,
                            webinar_id: next.webinar_id ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={ListChecks} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState
                        icon={ListChecks}
                        title={anyFilterActive ? t('empty_no_results') : t('empty_admin')}
                    />
                ) : (
                    <AssignmentsTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={(row) => {
                            setEditRow(row);
                            setUpsertOpen(true);
                        }}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </Card>

            {(canCreate || canEdit) ? (
                <UpsertAssignmentDialog
                    open={upsertOpen}
                    onOpenChange={(o) => {
                        setUpsertOpen(o);
                        if (!o) setEditRow(null);
                    }}
                    editing={editRow}
                />
            ) : null}
            {canDelete ? (
                <DeleteAssignmentDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    assignment={deleteRow}
                />
            ) : null}
        </PageShell>
    );
}
