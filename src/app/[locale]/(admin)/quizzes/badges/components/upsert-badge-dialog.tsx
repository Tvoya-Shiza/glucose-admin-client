'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { listCategories, upsertBadge } from '@/lib/quizzes/api';

/**
 * QZ-05 — create/edit a QuizBadge ("Пробное ЕНТ").
 *
 * Side-by-side RU + KZ titles, is_active checkbox, optional quiz_category_id.
 *
 * Categories selector: reuses listCategories (Plan 03 list endpoint). The category
 * is OPTIONAL — admins may leave it null (badge appears without category linkage).
 *
 * On submit invalidates ['admin.quiz-badges.list'] (and the detail key when editing)
 * and closes the dialog.
 */
const schema = z.object({
    kz_title: z.string().min(1).max(255),
    is_active: z.boolean(),
    quiz_category_id: z.number().int().min(1).nullable(),
});

type FormValues = z.infer<typeof schema>;

export interface UpsertBadgeDialogInitial {
    id: number;
    is_active: boolean;
    quiz_category_id: number | null;
    kz_title: string;
}

export interface UpsertBadgeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Existing row (edit mode). Undefined → create mode. */
    initial?: UpsertBadgeDialogInitial;
}

export function UpsertBadgeDialog({ open, onOpenChange, initial }: UpsertBadgeDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const isEdit = typeof initial?.id === 'number';

    const { data: categories = [] } = useQuery({
        queryKey: ['admin.quiz-categories.list'],
        queryFn: listCategories,
        // Categories list is small + cached server-side; refresh when dialog opens.
        enabled: open,
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            kz_title: initial?.kz_title ?? '',
            is_active: initial?.is_active ?? true,
            quiz_category_id: initial?.quiz_category_id ?? null,
        },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                kz_title: initial?.kz_title ?? '',
                is_active: initial?.is_active ?? true,
                quiz_category_id: initial?.quiz_category_id ?? null,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial?.id]);

    const mutation = useMutation({
        mutationFn: (values: FormValues) =>
            upsertBadge({
                id: isEdit ? initial!.id : undefined,
                is_active: values.is_active,
                quiz_category_id: values.quiz_category_id,
                translations: [{ locale: 'kz', title: values.kz_title.trim() }],
            }),
        onSuccess: (row) => {
            toast.success(isEdit ? t('badge_update_success') : t('badge_create_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
            if (isEdit) {
                qc.invalidateQueries({ queryKey: ['admin.quiz-badges.detail', row.id] });
            }
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    const submit = form.handleSubmit((values) => mutation.mutate(values));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? t('edit_badge') : t('create_badge')}
                    </DialogTitle>
                    <DialogDescription>{t('badge_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={submit} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='kz_title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('kz_title')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder={t('badge_title_placeholder_kz')}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='quiz_category_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('badge_category_label')}</FormLabel>
                                    <Select
                                        value={
                                            field.value == null
                                                ? '__none__'
                                                : String(field.value)
                                        }
                                        onValueChange={(v) =>
                                            field.onChange(v === '__none__' ? null : Number(v))
                                        }
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={t('badge_category_placeholder')}
                                                />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value='__none__'>
                                                {t('badge_category_none')}
                                            </SelectItem>
                                            {categories.map((c) => {
                                                const kz =
                                                    c.translations.find((tr) => tr.locale === 'kz')
                                                        ?.title ?? `#${c.id}`;
                                                return (
                                                    <SelectItem key={c.id} value={String(c.id)}>
                                                        {kz}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='is_active'
                            render={({ field }) => (
                                <FormItem className='flex items-center gap-2 space-y-0'>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(v) => field.onChange(!!v)}
                                        />
                                    </FormControl>
                                    <FormLabel className='!mt-0 cursor-pointer'>
                                        {t('badge_is_active_label')}
                                    </FormLabel>
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
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
