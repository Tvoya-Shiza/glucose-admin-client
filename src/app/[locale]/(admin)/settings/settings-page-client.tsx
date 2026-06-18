'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { usePermission } from '@/lib/access/use-permission';
import { fromDateInput, getUbtDate, toDateInput, updateUbtDate } from '@/lib/settings/api';

type UbtDateValues = { date: string };

const UBT_DATE_QUERY_KEY = ['settings', 'ubt-date'] as const;

export function SettingsPageClient() {
    const t = useTranslations('admin.settings');
    const canEdit = usePermission('settings.edit');
    const queryClient = useQueryClient();

    const { data, isPending } = useQuery({
        queryKey: UBT_DATE_QUERY_KEY,
        queryFn: getUbtDate,
        staleTime: 60 * 1000,
    });

    const schema = useMemo(() => z.object({ date: z.string().min(1, t('date_required')) }), [t]);

    const form = useForm<UbtDateValues>({
        resolver: zodResolver(schema),
        defaultValues: { date: '' },
        mode: 'onSubmit',
    });

    // Populate the form once the current value loads (or changes after a save).
    useEffect(() => {
        if (data?.date) form.reset({ date: toDateInput(data.date) });
    }, [data?.date, form]);

    const mutation = useMutation({
        mutationFn: (values: UbtDateValues) => updateUbtDate(fromDateInput(values.date)),
        onSuccess: (res) => {
            toast.success(t('saved'));
            queryClient.setQueryData(UBT_DATE_QUERY_KEY, res);
            form.reset({ date: toDateInput(res.date) });
        },
        onError: () => toast.error(t('save_error')),
    });

    return (
        <PageShell header={<PageHeader title={t('title')} subtitle={t('subtitle')} />}>
            <Card className='max-w-xl'>
                <CardHeader>
                    <CardTitle>{t('ubt_date_title')}</CardTitle>
                    <CardDescription>{t('ubt_date_description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
                            <FormField
                                control={form.control}
                                name='date'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('date_label')}</FormLabel>
                                        <FormControl>
                                            <Input type='date' disabled={!canEdit || isPending} {...field} />
                                        </FormControl>
                                        <FormDescription>{t('date_hint')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {canEdit && (
                                <Button type='submit' disabled={mutation.isPending || isPending}>
                                    {mutation.isPending ? t('saving') : t('save')}
                                </Button>
                            )}
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </PageShell>
    );
}
