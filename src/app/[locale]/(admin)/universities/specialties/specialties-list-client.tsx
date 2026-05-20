'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { usePermission } from '@/lib/access/use-permission';
import {
    createSpecialty,
    deleteSpecialty,
    listSpecialties,
    updateSpecialty,
} from '@/lib/universities/api';
import type { SpecialtyListRow } from '@/lib/universities/types';
import { ExportDropdown } from '../components/export-dropdown';
import { AnalyticsStrip } from '../components/analytics-strip';

export function SpecialtiesListClient() {
    const t = useTranslations('specialties');
    const canView = usePermission('specialties.view');
    const canCreate = usePermission('specialties.create');
    const canEdit = usePermission('specialties.edit');
    const canDelete = usePermission('specialties.delete');

    const [{ page, page_size, q, sort, order }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        q: parseAsString,
        sort: parseAsString.withDefault('code'),
        order: parseAsString.withDefault('asc'),
    });

    const queryKey = useMemo(
        () => ['admin.specialties.list', { page, page_size, q, sort, order }] as const,
        [page, page_size, q, sort, order],
    );
    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listSpecialties({
                page,
                page_size,
                q: q ?? undefined,
                sort: (sort as 'title_kk' | 'code' | 'created_at') ?? undefined,
                order: (order as 'asc' | 'desc') ?? undefined,
            }),
        placeholderData: (prev) => prev,
        enabled: canView,
    });
    const rows: SpecialtyListRow[] = data?.rows ?? [];

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editRow, setEditRow] = useState<SpecialtyListRow | null>(null);
    const [deleteRow, setDeleteRow] = useState<SpecialtyListRow | null>(null);

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        <div className='flex items-center gap-2'>
                            <ExportDropdown kind='specialties' />
                            {canCreate ? <Button onClick={() => setUpsertOpen(true)}>{t('create')}</Button> : null}
                        </div>
                    }
                />
            }
            footer={
                rows.length > 0 || page > 1 ? (
                    <DataTablePagination
                        page={page}
                        pageSize={page_size}
                        total={data?.total ?? 0}
                        rowCount={rows.length}
                        isFetching={isFetching}
                        onPageChange={(p) => setQ({ page: p })}
                        onPageSizeChange={(s) => setQ({ page: 1, page_size: s })}
                    />
                ) : null
            }
            contentClassName='space-y-4'
        >
            {canView ? <AnalyticsStrip variant='specialties' /> : null}
            <Card className='p-4'>
                <Input
                    className='max-w-sm'
                    placeholder={t('search_placeholder')}
                    value={q ?? ''}
                    onChange={(e) => setQ({ page: 1, q: e.target.value || null })}
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={BookOpen} title={t('error_generic')} subtitle={(error as Error).message} />
                ) : !isLoading && rows.length === 0 ? (
                    <EmptyState icon={BookOpen} title={t('empty_state')} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-[160px]'>{t('col_code')}</TableHead>
                                <TableHead>{t('col_title')}</TableHead>
                                <TableHead className='w-[140px]'>{t('col_universities')}</TableHead>
                                <TableHead className='w-[160px] text-right'>{t('col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 8 }).map((_, i) => (
                                      <TableRow key={`sk-${i}`}>
                                          <TableCell>
                                              <Skeleton className='h-4 w-20' />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton className='h-4 w-64' />
                                          </TableCell>
                                          <TableCell>
                                              <Skeleton className='h-4 w-12' />
                                          </TableCell>
                                          <TableCell />
                                      </TableRow>
                                  ))
                                : rows.map((row) => (
                                      <TableRow key={row.id}>
                                          <TableCell className='font-mono text-xs'>{row.code}</TableCell>
                                          <TableCell>{row.title_kk}</TableCell>
                                          <TableCell>
                                              <Badge variant='secondary'>{row.university_count}</Badge>
                                          </TableCell>
                                          <TableCell className='text-right'>
                                              {canEdit ? (
                                                  <Button variant='ghost' size='sm' onClick={() => setEditRow(row)}>
                                                      {t('edit')}
                                                  </Button>
                                              ) : null}
                                              {canDelete ? (
                                                  <Button
                                                      variant='ghost'
                                                      size='sm'
                                                      onClick={() => setDeleteRow(row)}
                                                      className='text-destructive hover:text-destructive'
                                                  >
                                                      {t('delete')}
                                                  </Button>
                                              ) : null}
                                          </TableCell>
                                      </TableRow>
                                  ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <UpsertSpecialtyDialog
                open={upsertOpen || editRow !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setUpsertOpen(false);
                        setEditRow(null);
                    }
                }}
                specialty={editRow}
            />
            <DeleteSpecialtyDialog
                open={deleteRow !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteRow(null);
                }}
                specialty={deleteRow}
            />
        </PageShell>
    );
}

function UpsertSpecialtyDialog({
    open,
    onOpenChange,
    specialty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    specialty: SpecialtyListRow | null;
}) {
    const t = useTranslations('specialties');
    const qc = useQueryClient();
    const [code, setCode] = useState(specialty?.code ?? '');
    const [title, setTitle] = useState(specialty?.title_kk ?? '');

    useMemo(() => {
        setCode(specialty?.code ?? '');
        setTitle(specialty?.title_kk ?? '');
    }, [specialty]);

    const save = useMutation({
        mutationFn: async () => {
            if (specialty) return updateSpecialty(specialty.id, { code, title_kk: title });
            return createSpecialty({ code, title_kk: title });
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.specialties.list'] });
            toast.success(t(specialty ? 'updated_toast' : 'created_toast'));
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{specialty ? t('edit_title') : t('create_title')}</DialogTitle>
                </DialogHeader>
                <div className='space-y-3'>
                    <div className='space-y-1'>
                        <Label>{t('field_code')} *</Label>
                        <Input value={code} onChange={(e) => setCode(e.target.value)} />
                    </div>
                    <div className='space-y-1'>
                        <Label>{t('field_title_kk')} *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending || !code || !title}>
                        {save.isPending ? t('saving') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteSpecialtyDialog({
    open,
    onOpenChange,
    specialty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    specialty: SpecialtyListRow | null;
}) {
    const t = useTranslations('specialties');
    const qc = useQueryClient();
    const remove = useMutation({
        mutationFn: async () => {
            if (!specialty) throw new Error('no_specialty');
            return deleteSpecialty(specialty.id);
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.specialties.list'] });
            toast.success(t('deleted_toast'));
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_title')}</DialogTitle>
                </DialogHeader>
                <p className='text-sm text-muted-foreground'>
                    {specialty ? t('delete_description', { code: specialty.code, name: specialty.title_kk }) : null}
                </p>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={() => remove.mutate()}
                        disabled={remove.isPending}
                    >
                        {remove.isPending ? t('deleting') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
