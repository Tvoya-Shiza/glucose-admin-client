'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { updateColumn } from '@/lib/rating-journal/api';
import type { JournalColumn, UpdateColumnPayload } from '@/lib/rating-journal/types';

export interface EditColumnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null closes the dialog; only manual (is_custom) columns should be passed. */
    column: JournalColumn | null;
    gridQueryKey: readonly unknown[];
}

function buildSchema(t: (key: string) => string) {
    return z.object({
        title: z.string().min(1, t('validation_required')).max(255, t('validation_too_long')),
        max_score: z.number().int(t('validation_max_score')).min(1, t('validation_max_score')).max(1000, t('validation_max_score')),
    });
}

type EditFormValues = z.infer<ReturnType<typeof buildSchema>>;

/**
 * Rename / change-max dialog for manual columns. Auto columns are read-only and
 * never reach this dialog (the grid only wires an edit action for is_custom).
 */
export function EditColumnDialog({ open, onOpenChange, column, gridQueryKey }: EditColumnDialogProps) {
    const t = useTranslations('admin.ratingJournal');
    const qc = useQueryClient();

    const schema = useMemo(() => buildSchema(t), [t]);

    const form = useForm<EditFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: '', max_score: 100 },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open && column) {
            form.reset({ title: column.title, max_score: column.max_score });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, column]);

    const mutation = useMutation({
        mutationFn: (values: EditFormValues) => {
            if (!column) throw new Error('no column');
            const payload: UpdateColumnPayload = { title: values.title.trim(), max_score: values.max_score };
            return updateColumn(column.id, payload);
        },
        onSuccess: () => {
            toast.success(t('column_updated'));
            qc.invalidateQueries({ queryKey: gridQueryKey });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('edit_column_title')}</DialogTitle>
                    <DialogDescription>{t('edit_column_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('column_title_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='max_score'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('column_max_score_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type='number'
                                            min={1}
                                            max={1000}
                                            value={field.value === 0 ? '' : field.value}
                                            onChange={(e) => {
                                                const n = Number(e.target.value);
                                                field.onChange(e.target.value === '' || !Number.isFinite(n) ? 0 : n);
                                            }}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
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
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
