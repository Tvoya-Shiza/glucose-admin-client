'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Gamepad2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { listTrainers, publishTrainer, TrainerPublishBlockedError } from '@/lib/trainers/api';
import type { TrainerPublishStatus, TrainerRow } from '@/lib/trainers/types';
import { CreateTrainerDialog } from './components/create-trainer-dialog';
import { DeleteTrainerDialog } from './components/delete-trainer-dialog';
import { TrainersFilters } from './trainers-filters';
import { TrainersTable } from './trainers-table';

/**
 * Phase 38 — «Тренажёрлер» list page (ТЗ §5).
 *
 * URL state via nuqs: page/page_size (integers), q/publish_status/category_id
 * (strings/int). Filter changes reset page=1. TanStack Query keyed on the full
 * filter object with keepPrevious (placeholderData) for fl: rows persist while a
 * filter/page change refetches.
 *
 * Mutations:
 *   - Create (trainers.create): opens the create dialog → routes to detail.
 *   - Publish/Hide (trainers.publish): toggles publish_status inline; a 409
 *     publish_blocked (no questions / no courses) is surfaced with a reason toast.
 *   - Delete (trainers.delete): soft-delete dialog.
 */
export function TrainersListClient() {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();
    const qc = useQueryClient();

    const [{ page, page_size, publish_status, category_id, q }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        publish_status: parseAsString,
        category_id: parseAsInteger,
        q: parseAsString,
    });

    const canCreate = usePermission('trainers.create');
    const canEdit = usePermission('trainers.edit');
    const canDelete = usePermission('trainers.delete');
    const canPublish = usePermission('trainers.publish');
    const canMutate = canEdit || canDelete || canPublish;

    const queryKey = useMemo(
        () => ['admin.trainers.list', { page, page_size, publish_status, category_id, q }] as const,
        [page, page_size, publish_status, category_id, q]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listTrainers({
                page,
                page_size,
                publish_status: (publish_status as TrainerPublishStatus | null) ?? undefined,
                category_id: category_id ?? undefined,
                q: q ?? undefined,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: TrainerRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(publish_status || category_id || (q && q.trim().length > 0));
    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty');

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<TrainerRow | null>(null);

    const publishMutation = useMutation({
        mutationFn: (row: TrainerRow) => {
            const next: TrainerPublishStatus = row.publish_status === 'public' ? 'hidden' : 'public';
            return publishTrainer(row.id, { publish_status: next });
        },
        onSuccess: (result) => {
            toast.success(result.publish_status === 'public' ? t('publish_success') : t('hide_success'));
            qc.invalidateQueries({ queryKey: ['admin.trainers.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.trainers.detail', result.id] });
        },
        onError: (err: unknown) => {
            if (err instanceof TrainerPublishBlockedError) {
                toast.error(t('publish_blocked', { questions: err.question_count, courses: err.course_count }));
                return;
            }
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <>
                            <Button variant='outline' asChild>
                                <Link href={`/${locale}/trainers/themes`}>{t('themes_manage')}</Link>
                            </Button>
                            {canCreate ? <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button> : null}
                        </>
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
                <TrainersFilters
                    value={{
                        q: q ?? undefined,
                        publish_status: (publish_status as TrainerPublishStatus | null) ?? undefined,
                        category_id: category_id ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            publish_status: next.publish_status ?? null,
                            category_id: next.category_id ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Gamepad2} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Gamepad2} title={emptyTitle} />
                ) : (
                    <TrainersTable
                        rows={rows}
                        loading={isLoading}
                        canMutate={canMutate}
                        canDelete={canDelete}
                        canPublish={canPublish}
                        onDelete={(row) => setDeleteRow(row)}
                        onPublish={(row) => publishMutation.mutate(row)}
                    />
                )}
            </Card>

            {canCreate ? <CreateTrainerDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}
            {canDelete ? (
                <DeleteTrainerDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    trainer={deleteRow}
                />
            ) : null}
        </PageShell>
    );
}
