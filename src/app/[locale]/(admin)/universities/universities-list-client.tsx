'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Building2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { usePermission } from '@/lib/access/use-permission';
import { getUniversity, listUniversities } from '@/lib/universities/api';
import type { UniversityDetail, UniversityListRow } from '@/lib/universities/types';
import { UniversitiesFilters } from './universities-filters';
import { UniversitiesTable } from './universities-table';
import { UpsertUniversityDialog } from './components/upsert-university-dialog';
import { DeleteUniversityDialog } from './components/delete-university-dialog';
import { ExportDropdown } from './components/export-dropdown';
import { AnalyticsStrip } from './components/analytics-strip';

export function UniversitiesListClient() {
    const t = useTranslations('universities');
    const locale = useLocale();
    const canView = usePermission('universities.view');
    const canCreate = usePermission('universities.create');
    const canEdit = usePermission('universities.edit');
    const canDelete = usePermission('universities.delete');
    const canImport = usePermission('universities.import');

    const [{ page, page_size, q, has_dormitory, has_military_department, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        has_dormitory: parseAsString,
        has_military_department: parseAsString,
        sort: parseAsString.withDefault('title_kk'),
        order: parseAsString.withDefault('asc'),
    });

    const queryKey = useMemo(
        () => ['admin.universities.list', { page, page_size, q, has_dormitory, has_military_department, sort, order }] as const,
        [page, page_size, q, has_dormitory, has_military_department, sort, order],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listUniversities({
                page,
                page_size,
                q: q ?? undefined,
                has_dormitory: has_dormitory === 'y' ? true : has_dormitory === 'n' ? false : undefined,
                has_military_department:
                    has_military_department === 'y' ? true : has_military_department === 'n' ? false : undefined,
                sort: (sort as 'title_kk' | 'unik' | 'created_at' | 'updated_at') ?? undefined,
                order: (order as 'asc' | 'desc') ?? undefined,
            }),
        placeholderData: (prev) => prev,
        enabled: canView,
    });

    const rows: UniversityListRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;
    const filtered = Boolean(q || has_dormitory || has_military_department);

    const [createOpen, setCreateOpen] = useState(false);
    const [editUni, setEditUni] = useState<UniversityDetail | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<UniversityListRow | null>(null);

    const onEdit = async (row: UniversityListRow) => {
        try {
            const detail = await getUniversity(row.id);
            setEditUni(detail);
            setEditOpen(true);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <div className='flex items-center gap-2'>
                            <ExportDropdown kind='universities' />
                            {canImport ? (
                                <Button variant='outline' size='sm' asChild>
                                    <Link href={`/${locale}/universities/import`}>
                                        <Upload className='mr-2 size-4' />
                                        {t('import_button')}
                                    </Link>
                                </Button>
                            ) : null}
                            {canCreate ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
                        </div>
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
            {canView ? <AnalyticsStrip variant='universities' /> : null}
            <Card className='p-4'>
                <UniversitiesFilters
                    value={{
                        q: q ?? undefined,
                        has_dormitory: has_dormitory === 'y' ? true : has_dormitory === 'n' ? false : undefined,
                        has_military_department:
                            has_military_department === 'y' ? true : has_military_department === 'n' ? false : undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            has_dormitory:
                                next.has_dormitory === true ? 'y' : next.has_dormitory === false ? 'n' : null,
                            has_military_department:
                                next.has_military_department === true
                                    ? 'y'
                                    : next.has_military_department === false
                                      ? 'n'
                                      : null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Building2} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Building2} title={filtered ? t('empty_filtered') : t('empty_state')} />
                ) : (
                    <UniversitiesTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={(r) => void onEdit(r)}
                        onDelete={(r) => setDeleteRow(r)}
                    />
                )}
            </Card>

            <UpsertUniversityDialog open={createOpen} onOpenChange={setCreateOpen} university={null} />
            <UpsertUniversityDialog
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) setEditUni(null);
                }}
                university={editUni}
            />
            <DeleteUniversityDialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
                university={deleteRow}
            />
        </PageShell>
    );
}
