'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Palette } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/lib/access/use-permission';
import { listTrainerThemes } from '@/lib/trainers/api';
import type { TrainerThemeRow } from '@/lib/trainers/types';
import { UpsertThemeDialog } from './components/upsert-theme-dialog';
import { ThemesTable } from './themes-table';

/**
 * Phase 43 — справочник тем оформления тренажёра.
 *
 * Тема = фон игры + палитра плиток ответов; ученик переключает её прямо в
 * игровом меню. Своей группы прав у тем нет: чтение — `trainers.view` (уже
 * навешано на маршрут `/trainers`), правка — `trainers.edit`.
 *
 * Удаления нет: тему может держать открытая попытка, а FK стоит на SET NULL —
 * «удалить» значило бы молча снять оформление с тренажёров. Тема убирается
 * переключателем «скрыта».
 */
export function ThemesListClient() {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();

    const [{ page, page_size, q }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
    });

    const canEdit = usePermission('trainers.edit');

    const [qLocal, setQLocal] = useState(q ?? '');
    useEffect(() => {
        const id = setTimeout(() => {
            if ((q ?? '') !== qLocal) setQ({ page: 1, q: qLocal || null });
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    const queryKey = useMemo(() => ['admin.trainer-themes.list', { page, page_size, q }] as const, [page, page_size, q]);

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () => listTrainerThemes({ page, page_size, q: q ?? undefined }),
        placeholderData: (prev) => prev,
    });

    const rows: TrainerThemeRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editRow, setEditRow] = useState<TrainerThemeRow | null>(null);

    const emptyTitle = q && q.trim().length > 0 ? t('empty_no_results') : t('themes_empty');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('themes_title')}
                    subtitle={t('themes_subtitle')}
                    breadcrumbs={[{ label: t('list_title'), href: `/${locale}/trainers` }, { label: t('themes_title') }]}
                    actions={
                        canEdit ? (
                            <Button
                                onClick={() => {
                                    setEditRow(null);
                                    setUpsertOpen(true);
                                }}
                            >
                                {t('themes_create')}
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
                <div className='flex flex-wrap items-center gap-3'>
                    <Input
                        className='max-w-sm'
                        placeholder={t('themes_search_placeholder')}
                        value={qLocal}
                        onChange={(e) => setQLocal(e.target.value)}
                    />
                </div>
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Palette} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={Palette} title={emptyTitle} />
                ) : (
                    <ThemesTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        onEdit={(row) => {
                            setEditRow(row);
                            setUpsertOpen(true);
                        }}
                    />
                )}
            </Card>

            <UpsertThemeDialog open={upsertOpen} onOpenChange={setUpsertOpen} theme={editRow} />
        </PageShell>
    );
}
