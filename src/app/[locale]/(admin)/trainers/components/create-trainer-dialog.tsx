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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { QuizCategoryPicker } from '@/components/quizzes/quiz-category-picker';
import { createTrainer } from '@/lib/trainers/api';
import type { CreateTrainer } from '@/lib/trainers/types';

/**
 * Phase 38 — trainer creation dialog. Minimal by design: only the KZ title is
 * required (+ an optional category). The freshly created trainer is born HIDDEN
 * server-side; the operator lands on the detail Settings tab to configure timer /
 * shuffle / courses / availability, then publishes there. Mirrors the create-quiz
 * dialog "create minimal → route to detail editor" flow.
 */
const createTrainerSchema = z.object({
    title: z.string().min(1).max(500),
    category_id: z.number().int().positive().nullable(),
});

type CreateTrainerValues = z.infer<typeof createTrainerSchema>;

export interface CreateTrainerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateTrainerDialog({ open, onOpenChange }: CreateTrainerDialogProps) {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const form = useForm<CreateTrainerValues>({
        resolver: zodResolver(createTrainerSchema),
        defaultValues: { title: '', category_id: null },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) form.reset({ title: '', category_id: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreateTrainerValues) => {
            const payload: CreateTrainer = {
                title: values.title.trim(),
                category_id: values.category_id,
            };
            return createTrainer(payload);
        },
        onSuccess: (created) => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.trainers.list'], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/trainers/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
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
                            name='category_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('category_label')}</FormLabel>
                                    <FormControl>
                                        <QuizCategoryPicker
                                            value={field.value ?? null}
                                            onChange={(id) => field.onChange(id)}
                                            placeholder={t('filter_category')}
                                            allowInlineCreate={false}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
