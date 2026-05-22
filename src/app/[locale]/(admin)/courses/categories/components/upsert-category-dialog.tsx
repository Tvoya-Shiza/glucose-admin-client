'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import {
    createCourseCategory,
    updateCourseCategory,
    type CourseCategoryRow,
} from '@/lib/courses/api';

const schema = z.object({
    slug: z
        .string()
        .min(1, 'slug_required')
        .max(255)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, 'slug_invalid_format'),
    title_kz: z.string().max(255).optional(),
});
type Values = z.infer<typeof schema>;

export interface UpsertCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Editing an existing row when supplied; create mode when null. */
    initial: CourseCategoryRow | null;
    /** When provided, fires with the newly-created row so callers (e.g. CategoryPicker)
     *  can auto-select it. Ignored in edit mode. */
    onCreated?: (row: CourseCategoryRow) => void;
}

export function UpsertCategoryDialog({
    open,
    onOpenChange,
    initial,
    onCreated,
}: UpsertCategoryDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const isEdit = initial != null;

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { slug: '', title_kz: '' },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                slug: initial?.slug ?? '',
                title_kz: initial?.title_kz ?? '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial]);

    const mutation = useMutation({
        mutationFn: async (values: Values) => {
            const payload = {
                slug: values.slug.trim(),
                title_kz: values.title_kz?.trim() ?? '',
            };
            return isEdit
                ? updateCourseCategory(initial!.id, payload)
                : createCourseCategory(payload);
        },
        onSuccess: (row) => {
            qc.invalidateQueries({ queryKey: ['admin.courses.categories'], exact: false });
            toast.success(isEdit ? t('cat_updated_toast') : t('cat_created_toast'));
            if (!isEdit) onCreated?.(row);
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('slug_already_exists')) toast.error(t('cat_slug_taken'));
            else if (msg.includes('slug_invalid_format')) toast.error(t('cat_slug_invalid'));
            else if (msg.includes('slug_required')) toast.error(t('cat_slug_required'));
            else toast.error(t('save_failed'));
        },
    });

    const errors = form.formState.errors;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('cat_edit_title') : t('cat_create_title')}</DialogTitle>
                    <DialogDescription>{t('cat_dialog_description')}</DialogDescription>
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
                                    <FormLabel>{t('cat_slug_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder='example-slug'
                                            autoComplete='off'
                                            disabled={mutation.isPending}
                                            {...field}
                                        />
                                    </FormControl>
                                    {errors.slug ? (
                                        <p className='text-destructive text-xs'>
                                            {errors.slug.message === 'slug_invalid_format'
                                                ? t('cat_slug_invalid')
                                                : errors.slug.message === 'slug_required'
                                                  ? t('cat_slug_required')
                                                  : t('save_failed')}
                                        </p>
                                    ) : (
                                        <FormMessage />
                                    )}
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='title_kz'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('cat_title_kz_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t('cat_title_kz_placeholder')}
                                            autoComplete='off'
                                            disabled={mutation.isPending}
                                            {...field}
                                        />
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
