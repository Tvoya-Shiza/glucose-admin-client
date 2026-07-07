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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createColumn } from '@/lib/rating-journal/api';
import type { CreateColumnPayload } from '@/lib/rating-journal/types';

export interface CreateColumnDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    journalId: string;
    /** Grid query key so the parent list refreshes after a create. */
    gridQueryKey: readonly unknown[];
    nextPosition: number;
}

function buildSchema(t: (key: string) => string) {
    return z.object({
        title: z.string().min(1, t('validation_required')).max(255, t('validation_too_long')),
        max_score: z.number().int(t('validation_max_score')).min(1, t('validation_max_score')).max(1000, t('validation_max_score')),
        source_kind: z.enum(['custom', 'attendance']),
    });
}

type ColumnFormValues = z.infer<ReturnType<typeof buildSchema>>;

const EMPTY: ColumnFormValues = { title: '', max_score: 100, source_kind: 'custom' };

/**
 * Add-column dialog (RHF + zod). Only manual kinds (custom / attendance) may be
 * created from the UI. Mirrors CreateCreditDialog.
 */
export function CreateColumnDialog({ open, onOpenChange, journalId, gridQueryKey, nextPosition }: CreateColumnDialogProps) {
    const t = useTranslations('admin.ratingJournal');
    const qc = useQueryClient();

    const schema = useMemo(() => buildSchema(t), [t]);

    const form = useForm<ColumnFormValues>({
        resolver: zodResolver(schema),
        defaultValues: EMPTY,
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) form.reset(EMPTY);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: ColumnFormValues) => {
            const payload: CreateColumnPayload = {
                journal_id: journalId,
                title: values.title.trim(),
                max_score: values.max_score,
                source_kind: values.source_kind,
                position: nextPosition,
            };
            return createColumn(payload);
        },
        onSuccess: () => {
            toast.success(t('column_created'));
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
                    <DialogTitle>{t('add_column_title')}</DialogTitle>
                    <DialogDescription>{t('add_column_description')}</DialogDescription>
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
                        <FormField
                            control={form.control}
                            name='source_kind'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('column_kind_label')}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value='custom'>{t('column_kind_custom')}</SelectItem>
                                            <SelectItem value='attendance'>{t('column_kind_attendance')}</SelectItem>
                                        </SelectContent>
                                    </Select>
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
