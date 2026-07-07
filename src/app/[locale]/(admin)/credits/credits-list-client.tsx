'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BookOpenCheck, FileQuestion, MessageSquareQuote } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { listCredits } from '@/lib/credits/api';
import { fromDateInputEnd, fromDateInputStart } from '@/lib/credits/format';
import type { CreditRow, CreditStatus } from '@/lib/credits/types';
import { CreateCreditDialog } from './components/create-credit-dialog';
import { DeleteCreditDialog } from './components/delete-credit-dialog';
import { LaunchWizardDialog } from './components/launch-wizard-dialog';
import { CreditsFilters } from './credits-filters';
import { CreditsTable } from './credits-table';

/**
 * Phase 34 — credits list page. TanStack Query + nuqs URL state
 * (page/page_size/q/group_id/status/date range), mirrors quizzes-list-client.
 */
export function CreditsListClient() {
    const t = useTranslations('admin.credits');
    const locale = useLocale();

    const [{ page, page_size, q, group_id, status, date_from, date_to }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        group_id: parseAsInteger,
        status: parseAsString,
        date_from: parseAsString,
        date_to: parseAsString,
    });

    const canCreate = usePermission('credits.create');
    const canConduct = usePermission('credits.conduct');
    const canDelete = usePermission('credits.delete');

    const queryKey = useMemo(
        () => ['admin.credits.list', { page, page_size, q, group_id, status, date_from, date_to }] as const,
        [page, page_size, q, group_id, status, date_from, date_to]
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listCredits({
                page,
                page_size,
                search: q ?? undefined,
                group_id: group_id ?? undefined,
                status: (status as CreditStatus | null) ?? undefined,
                date_from: fromDateInputStart(date_from),
                date_to: fromDateInputEnd(date_to),
            }),
        staleTime: 0,
        placeholderData: (prev) => prev,
    });

    const rows: CreditRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;

    const anyFilterActive = Boolean(status || group_id || date_from || date_to || (q && q.trim().length > 0));

    const [createOpen, setCreateOpen] = useState(false);
    const [deleteRow, setDeleteRow] = useState<CreditRow | null>(null);
    const [launchRow, setLaunchRow] = useState<CreditRow | null>(null);

    const emptyTitle = anyFilterActive ? t('empty_no_results') : t('empty_admin');

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <>
                            <Button asChild variant='outline' size='sm'>
                                <Link href={`/${locale}/credits/questions`}>
                                    <FileQuestion className='mr-2 h-4 w-4' />
                                    {t('questions_page_link')}
                                </Link>
                            </Button>
                            <Button asChild variant='outline' size='sm'>
                                <Link href={`/${locale}/credits/result-texts`}>
                                    <MessageSquareQuote className='mr-2 h-4 w-4' />
                                    {t('result_texts_link')}
                                </Link>
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
            <Card className='p-0'>
                <CreditsFilters
                    value={{
                        q: q ?? undefined,
                        group_id: group_id ?? undefined,
                        status: (status as CreditStatus | null) ?? undefined,
                        date_from: date_from ?? undefined,
                        date_to: date_to ?? undefined,
                    }}
                    onChange={(next) =>
                        setQ({
                            page: 1,
                            q: next.q ?? null,
                            group_id: next.group_id ?? null,
                            status: next.status ?? null,
                            date_from: next.date_from ?? null,
                            date_to: next.date_to ?? null,
                        })
                    }
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={BookOpenCheck} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={BookOpenCheck} title={emptyTitle} />
                ) : (
                    <CreditsTable
                        rows={rows}
                        loading={isLoading}
                        canConduct={canConduct}
                        canDelete={canDelete}
                        onLaunch={(row) => setLaunchRow(row)}
                        onDelete={(row) => setDeleteRow(row)}
                    />
                )}
            </Card>

            {canCreate ? <CreateCreditDialog open={createOpen} onOpenChange={setCreateOpen} /> : null}
            {canDelete ? (
                <DeleteCreditDialog
                    open={deleteRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleteRow(null);
                    }}
                    credit={deleteRow}
                />
            ) : null}
            {canConduct && launchRow ? (
                <LaunchWizardDialog
                    open={launchRow !== null}
                    onOpenChange={(o) => {
                        if (!o) setLaunchRow(null);
                    }}
                    creditId={launchRow.id}
                    creditTitle={launchRow.title}
                />
            ) : null}
        </PageShell>
    );
}
