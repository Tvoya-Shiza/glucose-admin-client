'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermission } from '@/lib/access/use-permission';
import { updateCredit } from '@/lib/credits/api';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import { fromDatetimeLocal, toDatetimeLocal } from '@/lib/credits/format';
import type { CreditDetail, CreditStatus, UpdateCreditPayload } from '@/lib/credits/types';
import { CreditFormFields, buildCreditFormSchema, type CreditFormValues } from '../../components/credit-form-fields';

type OverviewValues = CreditFormValues & { status: CreditStatus };

function toValues(c: CreditDetail): OverviewValues {
    return {
        title: c.title,
        description: c.description ?? '',
        group_id: c.group?.id ?? null,
        course_id: c.course?.id ?? null,
        chapter_id: c.chapter?.id ?? null,
        lesson_item_ids: c.lesson_item_ids ?? [],
        scheduled_at: toDatetimeLocal(c.scheduled_at),
        status: c.status,
    };
}

/**
 * Overview tab — view + edit form gated by `credits.edit` (fields disabled and
 * save hidden without it). PATCH sends the full editable field set;
 * lesson_item_ids replaces links diff-wise server-side.
 */
export function OverviewTab({ credit }: { credit: CreditDetail }) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const qc = useQueryClient();
    const canEdit = usePermission('credits.edit');

    const schema = useMemo(() => buildCreditFormSchema(t).extend({ status: z.enum(['draft', 'active', 'archived']) }), [t]);

    const form = useForm<OverviewValues>({
        resolver: zodResolver(schema),
        defaultValues: toValues(credit),
        mode: 'onSubmit',
    });

    // Re-sync when the detail payload changes (e.g. after a save round-trip).
    useEffect(() => {
        form.reset(toValues(credit));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credit]);

    const mutation = useMutation({
        mutationFn: (values: OverviewValues) => {
            const payload: UpdateCreditPayload = {
                title: values.title.trim(),
                description: values.description.trim() !== '' ? values.description.trim() : undefined,
                group_id: values.group_id as number,
                course_id: values.course_id as number,
                chapter_id: values.chapter_id as number,
                lesson_item_ids: values.lesson_item_ids,
                scheduled_at: fromDatetimeLocal(values.scheduled_at),
                status: values.status,
            };
            return updateCredit(credit.id, payload);
        },
        onSuccess: (updated) => {
            toast.success(t('saved'));
            qc.setQueryData(['admin.credits.detail', credit.id], updated);
            qc.invalidateQueries({ queryKey: ['admin.credits.list'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Card className='max-w-3xl'>
            <CardHeader>
                <CardTitle>{t('overview_title')}</CardTitle>
                <CardDescription>{t('overview_created_at', { date: formatUnixSecondsOrDash(credit.created_at, locale) })}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='status'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('status_label')}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
                                        <FormControl>
                                            <SelectTrigger className='w-56'>
                                                <SelectValue placeholder={t('status_label')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value='draft'>{t('status_draft')}</SelectItem>
                                            <SelectItem value='active'>{t('status_active')}</SelectItem>
                                            <SelectItem value='archived'>{t('status_archived')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <CreditFormFields form={form as unknown as UseFormReturn<CreditFormValues>} disabled={!canEdit} />
                        {canEdit ? (
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving') : t('save')}
                            </Button>
                        ) : null}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
