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
    createStoryCategory,
    deleteStoryCategory,
    listStoryCategories,
    updateStoryCategory,
} from '@/lib/stories/api';
import type { StoryCategoryRow } from '@/lib/stories/types';

const categorySchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(255)
        .refine((v) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(v), { message: 'slug_invalid_format' }),
    title_ru: z.string().min(1).max(255),
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
    category: StoryCategoryRow | null;
}) {
    const t = useTranslations('admin.stories');
    const qc = useQueryClient();
    const isEdit = !!category;

    const form = useForm<CategoryValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            slug: category?.slug ?? '',
            title_ru: category?.title_ru ?? '',
            title_kz: category?.title_kz ?? '',
        },
        mode: 'onSubmit',
    });

    // Reset form when dialog opens/closes or category changes.
    if (open) {
        // sync form on each render of the open dialog (cheap since form is local)
    }

    const mutation = useMutation({
        mutationFn: (values: CategoryValues) =>
            isEdit
                ? updateStoryCategory(category!.id, values)
                : createStoryCategory(values),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.stories.categories'], exact: false });
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
                        slug: category?.slug ?? '',
                        title_ru: category?.title_ru ?? '',
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
                            name='slug'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('categories_slug_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='title_ru'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_ru_label')}</FormLabel>
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

/**
 * STY-02 — story categories list + CRUD.
 *
 * No bulk actions; small flat surface (D-15). Delete attempts hard delete; on
 * 400 'stories.category_in_use' the Error.message is surfaced via toast (the
 * backend BadRequestException uses the i18n key as the message).
 */
export function CategoriesClient() {
    const t = useTranslations('admin.stories');
    const locale = useLocale() as 'ru' | 'kz';
    const qc = useQueryClient();

    const [editing, setEditing] = useState<StoryCategoryRow | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const cats = useQuery({
        queryKey: ['admin.stories.categories'],
        queryFn: () => listStoryCategories(),
        staleTime: 60_000,
    });

    const del = useMutation({
        mutationFn: (id: number) => deleteStoryCategory(id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.stories.categories'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            // Surface the backend i18n key as a friendly toast.
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
                        <Link href={`/${locale}/stories`} className='hover:underline'>
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
                            <TableHead>{t('categories_slug_label')}</TableHead>
                            <TableHead>{t('title_ru_label')}</TableHead>
                            <TableHead>{t('title_kz_label')}</TableHead>
                            <TableHead className='w-32 text-right'>{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cats.isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`sk-${i}`}>
                                    <TableCell colSpan={5}>
                                        <Skeleton className='h-6 w-full' />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (cats.data ?? []).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className='py-8 text-center text-muted-foreground'>
                                    {t('empty_state')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            (cats.data ?? []).map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className='font-mono text-xs'>{c.id}</TableCell>
                                    <TableCell>{c.slug}</TableCell>
                                    <TableCell>{c.title_ru ?? '—'}</TableCell>
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
                                                            `${t('categories_delete')}: ${c.title_ru ?? c.slug}?`,
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
