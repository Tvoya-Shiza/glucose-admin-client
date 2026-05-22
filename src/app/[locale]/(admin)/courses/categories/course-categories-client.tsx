'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/lib/access/use-permission';
import {
    CategoryDependentsError,
    deleteCourseCategory,
    listCourseCategories,
    type CourseCategoryRow,
} from '@/lib/courses/api';
import { UpsertCategoryDialog } from './components/upsert-category-dialog';

/**
 * /kz/courses/categories — flat CRUD over WebinarCategory.
 *
 * Scope (per user choice): slug + KZ title only. parent_id / icon / order stay
 * editable through DB until the operator workflow needs them. Delete is BLOCKED
 * (409) when courses or child categories still point at the row — UI surfaces
 * those counts so the operator can fix the dependency before retrying.
 *
 * Permission gates piggyback on the existing courses.* permission set:
 *   - render this page if the user can view courses (read);
 *   - show create/edit/delete buttons gated by courses.create/edit/delete.
 */
export function CourseCategoriesClient() {
    const t = useTranslations('admin.courses');
    const locale = useLocale();
    const qc = useQueryClient();
    const canCreate = usePermission('courses.create');
    const canEdit = usePermission('courses.edit');
    const canDelete = usePermission('courses.delete');

    const [q, setQ] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['admin.courses.categories', { q }],
        queryFn: () => listCourseCategories({ q: q || undefined, page_size: 200 }),
        staleTime: 30_000,
    });

    const rows = useMemo(() => data?.rows ?? [], [data]);

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<CourseCategoryRow | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<CourseCategoryRow | null>(null);
    const [blockedCounts, setBlockedCounts] = useState<{
        course_count: number;
        child_count: number;
    } | null>(null);

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCourseCategory(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.courses.categories'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            toast.success(t('cat_deleted_toast'));
            setDeleteTarget(null);
            setBlockedCounts(null);
        },
        onError: (err: unknown) => {
            if (err instanceof CategoryDependentsError) {
                setBlockedCounts({
                    course_count: err.course_count,
                    child_count: err.child_count,
                });
                return;
            }
            toast.error(t('cat_delete_failed'));
        },
    });

    const openCreate = () => {
        setEditTarget(null);
        setUpsertOpen(true);
    };
    const openEdit = (row: CourseCategoryRow) => {
        setEditTarget(row);
        setUpsertOpen(true);
    };
    const requestDelete = (row: CourseCategoryRow) => {
        setBlockedCounts(null);
        setDeleteTarget(row);
    };
    const closeDelete = () => {
        setDeleteTarget(null);
        setBlockedCounts(null);
    };

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('cat_page_title')}
                    subtitle={t('cat_page_subtitle')}
                    breadcrumbs={[
                        { label: t('list_title'), href: `/${locale}/courses` },
                        { label: t('cat_page_title') },
                    ]}
                    actions={
                        canCreate ? (
                            <Button onClick={openCreate}>
                                <Plus className='mr-1 size-4' />
                                {t('cat_add')}
                            </Button>
                        ) : undefined
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Card className='p-3'>
                <Input
                    className='max-w-sm'
                    placeholder={t('cat_search_placeholder')}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
            </Card>

            <Card className='overflow-hidden p-0'>
                {isLoading ? (
                    <div className='space-y-2 p-4'>
                        <Skeleton className='h-8 w-full' />
                        <Skeleton className='h-8 w-full' />
                        <Skeleton className='h-8 w-full' />
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState
                        title={q.length > 0 ? t('cat_empty_search') : t('cat_empty')}
                        subtitle={q.length > 0 ? undefined : t('cat_empty_hint')}
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-16'>ID</TableHead>
                                <TableHead>{t('cat_col_title')}</TableHead>
                                <TableHead>{t('cat_col_slug')}</TableHead>
                                <TableHead className='w-40 text-right'>{t('cat_col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className='font-mono text-xs text-muted-foreground'>
                                        #{r.id}
                                    </TableCell>
                                    <TableCell>
                                        {r.title_kz ?? (
                                            <span className='text-muted-foreground'>—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className='font-mono text-xs text-muted-foreground'>
                                        {r.slug}
                                    </TableCell>
                                    <TableCell className='space-x-1 text-right'>
                                        {canEdit ? (
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                onClick={() => openEdit(r)}
                                            >
                                                <Pencil className='mr-1 size-3' />
                                                {t('cat_edit')}
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                size='sm'
                                                variant='destructive'
                                                onClick={() => requestDelete(r)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className='size-3' />
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <UpsertCategoryDialog
                open={upsertOpen}
                onOpenChange={setUpsertOpen}
                initial={editTarget}
            />

            <Link href={`/${locale}/courses`} className='inline-flex'>
                <Button variant='ghost' size='sm'>
                    ← {t('cat_back_to_courses')}
                </Button>
            </Link>

            <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && closeDelete()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {blockedCounts
                                ? t('cat_delete_blocked_title')
                                : t('cat_delete_confirm_title')}
                        </DialogTitle>
                        <DialogDescription>
                            {blockedCounts
                                ? t('cat_delete_blocked_description', {
                                      courses: blockedCounts.course_count,
                                      children: blockedCounts.child_count,
                                  })
                                : deleteTarget
                                  ? t('cat_delete_confirm_description', {
                                        name: deleteTarget.title_kz ?? deleteTarget.slug,
                                    })
                                  : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={closeDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        {!blockedCounts ? (
                            <Button
                                type='button'
                                variant='destructive'
                                disabled={deleteMutation.isPending}
                                onClick={() =>
                                    deleteTarget && deleteMutation.mutate(deleteTarget.id)
                                }
                            >
                                {deleteMutation.isPending ? t('saving') : t('cat_delete_confirm')}
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
