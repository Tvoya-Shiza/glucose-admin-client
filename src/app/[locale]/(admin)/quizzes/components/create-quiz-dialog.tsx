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
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { QuizCategoryPicker } from '@/components/quizzes/quiz-category-picker';
import { createQuiz } from '@/lib/quizzes/api';
import type { CreateQuiz, QuizStatus } from '@/lib/quizzes/types';

/**
 * QZ-01 — admin/teacher quiz creation dialog with side-by-side RU+KZ titles.
 *
 * Both RU and KZ titles required at create time so the new quiz lands as
 * `translation_completeness=complete`. status defaults to 'active' (admin can
 * flip via select). pass_mark required (Quizzes.pass_mark NOT NULL on schema).
 *
 * On success: invalidate ['admin.quizzes.list'], toast success, navigate to
 * /[locale]/quizzes/:id (Plan 04 ships the detail editor).
 */
const createQuizSchema = z.object({
    status: z.enum(['active', 'inactive']),
    category_id: z.number().int().positive().nullable(),
    pass_mark: z
        .string()
        .min(1)
        .refine((v) => Number.isFinite(Number(v.trim())) && Number(v.trim()) >= 0, {
            message: 'invalid_number',
        }),
    time: z.string().optional(),
    attempt: z.string().optional(),
    certificate: z.boolean(),
    title: z.string().min(1).max(255),
});

type CreateQuizValues = z.infer<typeof createQuizSchema>;

export interface CreateQuizDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateQuizDialog({ open, onOpenChange }: CreateQuizDialogProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const form = useForm<CreateQuizValues>({
        resolver: zodResolver(createQuizSchema),
        defaultValues: {
            status: 'active',
            category_id: null,
            pass_mark: '0',
            time: '',
            attempt: '',
            certificate: false,
            title: '',
        },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) {
            form.reset({
                status: 'active',
                pass_mark: '0',
                time: '',
                attempt: '',
                certificate: false,
                title: '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreateQuizValues) => {
            const payload: CreateQuiz = {
                status: values.status as QuizStatus,
                category_id: values.category_id,
                pass_mark: Number(values.pass_mark.trim()),
                certificate: values.certificate,
                time:
                    values.time && values.time.trim() !== ''
                        ? Number(values.time.trim())
                        : null,
                attempt:
                    values.attempt && values.attempt.trim() !== ''
                        ? Number(values.attempt.trim())
                        : null,
                translations: [{ locale: 'kz', title: values.title }],
            };
            return createQuiz(payload);
        },
        onSuccess: (created) => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/quizzes/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='status'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('status_label')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('status_label')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='active'>
                                                    {t('status_active')}
                                                </SelectItem>
                                                <SelectItem value='inactive'>
                                                    {t('status_inactive')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='pass_mark'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('pass_mark_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value.replace(/[^\d]/g, ''),
                                                    )
                                                }
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='time'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('time_limit_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder={t('time_limit_unlimited')}
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value.replace(/[^\d]/g, ''),
                                                    )
                                                }
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='attempt'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('attempt_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder={t('attempt_unlimited')}
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value.replace(/[^\d]/g, ''),
                                                    )
                                                }
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='certificate'
                            render={({ field }) => (
                                <FormItem className='flex items-center gap-2'>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(v) => field.onChange(!!v)}
                                        />
                                    </FormControl>
                                    <FormLabel className='m-0'>{t('certificate_label')}</FormLabel>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_label')}</FormLabel>
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
                                {mutation.isPending ? t('loading') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
