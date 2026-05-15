'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { upsertCategory } from '@/lib/quizzes/api';
import type { UpsertCategory } from '@/lib/quizzes/types';

/**
 * QZ-04 — create/edit a QuizCategory with side-by-side RU + KZ titles.
 *
 * Caller controls parent_id:
 *   - Add root        → parent_id = null
 *   - Add child       → parent_id = node.id
 *   - Edit existing   → parent_id from node, prefilled
 *
 * On submit invalidates ['admin.quiz-categories.list'] and closes the dialog.
 */
const schema = z.object({
    kz_title: z.string().min(1).max(255),
});

type FormValues = z.infer<typeof schema>;

export interface UpsertCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Existing row (edit mode). Undefined → create mode. */
    initial?: {
        id: number;
        parent_id: number | null;
        kz_title: string;
    };
    /** Required in create mode; ignored in edit mode (stays from initial). */
    parentIdForCreate?: number | null;
}

export function UpsertCategoryDialog({
    open,
    onOpenChange,
    initial,
    parentIdForCreate,
}: UpsertCategoryDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const isEdit = typeof initial?.id === 'number';

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            kz_title: initial?.kz_title ?? '',
        },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                kz_title: initial?.kz_title ?? '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial?.id]);

    const mutation = useMutation({
        mutationFn: (values: FormValues) => {
            const payload: UpsertCategory = {
                ...(isEdit ? { id: initial!.id } : {}),
                parent_id: isEdit ? (initial!.parent_id ?? null) : (parentIdForCreate ?? null),
                translations: [{ locale: 'kz', title: values.kz_title }],
            };
            return upsertCategory(payload);
        },
        onSuccess: () => {
            toast.success(isEdit ? t('categories.updated_success') : t('categories.created_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-categories.list'] });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('categories.generic_error');
            toast.error(msg);
        },
    });

    const titleKey = isEdit
        ? 'categories.dialog_edit_title'
        : parentIdForCreate == null
          ? 'categories.dialog_create_root_title'
          : 'categories.dialog_create_child_title';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-xl'>
                <DialogHeader>
                    <DialogTitle>{t(titleKey)}</DialogTitle>
                    <DialogDescription>{t('categories.dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='kz_title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('categories.kz_title')}</FormLabel>
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
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
