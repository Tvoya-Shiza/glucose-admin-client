'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PublisherSelect } from '@/components/ebooks/publisher-select';
import { createBook } from '@/lib/ebooks/api';
import type { CreateBook } from '@/lib/ebooks/types';

/**
 * Phase 39/40 — book creation dialog. Minimal by design: only the KZ title is
 * required (+ optional publisher / grade / year). The book is born DRAFT
 * server-side — it can never be created 'active' because it has zero pages — so
 * the operator lands on the detail page to fill metadata, upload pages, and
 * publish from there. Mirrors CreateTrainerDialog's "create minimal → route to
 * detail editor" flow.
 */
const createBookSchema = z.object({
    title: z.string().min(1).max(512),
    publisher_id: z.number().int().positive().nullable(),
    grade: z.string(),
    year: z.string(),
});

type CreateBookValues = z.infer<typeof createBookSchema>;

const EMPTY: CreateBookValues = { title: '', publisher_id: null, grade: '', year: '' };

export interface CreateBookDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateBookDialog({ open, onOpenChange }: CreateBookDialogProps) {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const form = useForm<CreateBookValues>({
        resolver: zodResolver(createBookSchema),
        defaultValues: EMPTY,
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) form.reset(EMPTY);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreateBookValues) => {
            const grade = values.grade.trim() === '' ? undefined : Number(values.grade);
            const year = values.year.trim() === '' ? undefined : Number(values.year);
            const payload: CreateBook = {
                title: values.title.trim(),
                ...(values.publisher_id != null ? { publisher_id: values.publisher_id } : {}),
                ...(grade != null ? { grade } : {}),
                ...(year != null ? { year } : {}),
            };
            return createBook(payload);
        },
        onSuccess: (created) => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/ebooks/${created.id}`);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('title_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='publisher_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('publisher_label')}</FormLabel>
                                    <FormControl>
                                        <PublisherSelect
                                            value={field.value}
                                            onChange={(id) => field.onChange(id)}
                                            noneLabel={t('publisher_none')}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-2 gap-4'>
                            <FormField
                                control={form.control}
                                name='grade'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('grade_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder='11'
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormDescription>{t('grade_hint')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='year'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('year_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder='2024'
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormDescription>{t('year_hint')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
