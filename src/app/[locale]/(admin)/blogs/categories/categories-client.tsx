'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    createBlogCategory,
    deleteBlogCategory,
    listBlogCategories,
    updateBlogCategory,
} from '@/lib/blogs/api';
import type { BlogCategoryRow } from '@/lib/blogs/types';

/**
 * BLG-02 — blog categories list + CRUD.
 *
 * Schema-truth (Plan 01 lock): BlogCategory has NO `slug` column. The form here
 * therefore omits slug entirely, diverging from Story/Banner categories. Shape:
 * title_kz + title_kz only.
 *
 * No bulk actions; small flat surface (D-15). Delete attempts hard delete; on
 * 400 'blogs.category_in_use' the Error.message is surfaced via toast.
 */
const categorySchema = z.object({
    title_kz: z.string().min(1).max(255),
});

type CategoryValues = z.infer<typeof categorySchema>;

function CategoryDialog({
    open,
    onOpenChange,
    category,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: BlogCategoryRow | null;
}) {
    const t = useTranslations('admin.blogs');
    const qc = useQueryClient();
    const isEdit = !!category;

    const form = useForm<CategoryValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            title_kz: category?.title_kz ?? '',
        },
        mode: 'onSubmit',
    });

    const mutation = useMutation({
        mutationFn: (values: CategoryValues) =>
            isEdit ? updateBlogCategory(category!.id, values) : createBlogCategory(values),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.categories'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (o) {
                    form.reset({
                        title_kz: category?.title_kz ?? '',
                    });
                }
                onOpenChange(o);
            }}
        >
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? t('categories_edit') : t('categories_create')}
                    </DialogTitle>
                    <DialogDescription>{t('categories_title')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='title_kz'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_kz_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='title_kz'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_kz_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function CategoriesClient() {
    const t = useTranslations('admin.blogs');
    const locale = useLocale();
    const qc = useQueryClient();

    const [editing, setEditing] = useState<BlogCategoryRow | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const cats = useQuery({
        queryKey: ['admin.blogs.categories'],
        queryFn: () => listBlogCategories(),
        staleTime: 60_000,
    });

    const del = useMutation({
        mutationFn: (id: number) => deleteBlogCategory(id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.categories'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            if (msg.includes('category_in_use')) {
                toast.error(t('categories_in_use_error'));
            } else {
                toast.error(msg);
            }
        },
    });

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between p-6'>
                <div>
                    <h1 className='text-2xl font-semibold'>{t('categories_title')}</h1>
                    <p className='text-muted-foreground text-sm'>
                        <Link href={`/${locale}/blogs`} className='hover:underline'>
                            ← {t('list_title')}
                        </Link>
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>{t('categories_create')}</Button>
            </header>

            <div className='flex-1 overflow-auto'>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('col_id')}</TableHead>
                            <TableHead>{t('title_kz_label')}</TableHead>
                            <TableHead>{t('title_kz_label')}</TableHead>
                            <TableHead className='w-32 text-right'>{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cats.isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`sk-${i}`}>
                                    <TableCell colSpan={4}>
                                        <Skeleton className='h-6 w-full' />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (cats.data ?? []).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className='py-8 text-center text-muted-foreground'>
                                    {t('empty_state')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            (cats.data ?? []).map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className='font-mono text-xs'>{c.id}</TableCell>
                                    <TableCell>{c.title_kz ?? '—'}</TableCell>
                                    <TableCell>{c.title_kz ?? '—'}</TableCell>
                                    <TableCell className='text-right'>
                                        <div className='flex justify-end gap-2'>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                onClick={() => {
                                                    setEditing(c);
                                                    setEditOpen(true);
                                                }}
                                            >
                                                {t('edit')}
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='destructive'
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            `${t('categories_delete')}: ${c.title_kz ?? `#${c.id}`}?`,
                                                        )
                                                    ) {
                                                        del.mutate(c.id);
                                                    }
                                                }}
                                                disabled={del.isPending}
                                            >
                                                {t('delete')}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CategoryDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                category={null}
            />
            <CategoryDialog
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) setEditing(null);
                }}
                category={editing}
            />
        </div>
    );
}
