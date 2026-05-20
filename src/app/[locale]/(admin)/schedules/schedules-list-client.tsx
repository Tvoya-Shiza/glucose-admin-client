'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { listSchedules } from '@/lib/schedules/api';
import type { Schedule } from '@/lib/schedules/types';
import type { ScheduleFiltersValue } from './schedules-filters';
import { SchedulesTable } from './schedules-table';

interface SchedulesListProps {
    filters: ScheduleFiltersValue;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (s: Schedule) => void;
    onDelete: (s: Schedule) => void;
}

export function SchedulesList({ filters, canEdit, canDelete, onEdit, onDelete }: SchedulesListProps) {
    const t = useTranslations('admin.schedules');

    const [{ page, page_size }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
    });

    const queryKey = useMemo(
        () => ['admin.schedules.list', { page, page_size, ...filters }] as const,
        [page, page_size, filters],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listSchedules({
                page,
                page_size,
                q: filters.q,
                status: filters.status,
                kind: filters.kind,
                curator_id: filters.curator_id,
                group_id: filters.group_id,
                course_id: filters.course_id,
                from: filters.from,
                to: filters.to,
                sort: 'start_at',
                order: 'desc',
            }),
        placeholderData: (prev) => prev,
    });

    const rows = data?.rows ?? [];
    const total = data?.total ?? 0;
    const anyFilterActive = Object.values(filters).some((v) => v !== undefined && v !== '');

    return (
        <>
            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={CalendarDays} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={anyFilterActive ? t('empty_no_results') : t('empty_admin')}
                    />
                ) : (
                    <SchedulesTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                )}
            </Card>
            {rows.length > 0 || page > 1 ? (
                <DataTablePagination
                    page={page}
                    pageSize={page_size}
                    total={total}
                    rowCount={rows.length}
                    isFetching={isFetching}
                    onPageChange={(p) => setQ({ page: p })}
                    onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                />
            ) : null}
        </>
    );
}
