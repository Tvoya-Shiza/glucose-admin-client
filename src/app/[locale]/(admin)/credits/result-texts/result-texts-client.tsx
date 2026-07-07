'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/lib/access/use-permission';
import { getCreditResultTexts, updateCreditResultTexts } from '@/lib/credits/api';
import type { CreditResultTextRange } from '@/lib/credits/types';

const RESULT_TEXTS_QUERY_KEY = ['admin.credits.result-texts'] as const;

/** The 4 fixed contiguous percent ranges (contract decision — not editable). */
const FIXED_RANGES: Array<{ min: number; max: number }> = [
    { min: 0, max: 25 },
    { min: 26, max: 50 },
    { min: 51, max: 75 },
    { min: 76, max: 100 },
];

function buildSchema(t: (key: string) => string) {
    return z.object({
        ranges: z
            .array(
                z.object({
                    min: z.number(),
                    max: z.number(),
                    text_kz: z.string().min(1, t('result_texts_required')),
                    text_ru: z.string(),
                })
            )
            .length(FIXED_RANGES.length),
    });
}

type Values = z.infer<ReturnType<typeof buildSchema>>;

function toValues(ranges: CreditResultTextRange[]): Values {
    return {
        ranges: FIXED_RANGES.map((fixed) => {
            const match = ranges.find((r) => r.min === fixed.min && r.max === fixed.max);
            return {
                min: fixed.min,
                max: fixed.max,
                text_kz: match?.text_kz ?? '',
                text_ru: match?.text_ru ?? '',
            };
        }),
    };
}

/**
 * Phase 34 — motivational result texts (settings pattern): 4 fixed range
 * cards (0–25 / 26–50 / 51–75 / 76–100), required text_kz + collapsible
 * optional text_ru, saved via PATCH /credit-settings/result-texts.
 * Gated by `credits.texts_manage`.
 */
export function ResultTextsClient() {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const qc = useQueryClient();
    const canEdit = usePermission('credits.texts_manage');

    const { data, isPending } = useQuery({
        queryKey: RESULT_TEXTS_QUERY_KEY,
        queryFn: getCreditResultTexts,
        staleTime: 60_000,
    });

    const schema = useMemo(() => buildSchema(t), [t]);

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: toValues([]),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (data) form.reset(toValues(data));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const [ruOpen, setRuOpen] = useState<boolean[]>(FIXED_RANGES.map(() => false));

    // Auto-expand the RU disclosure for ranges that already carry a RU text.
    useEffect(() => {
        if (data) setRuOpen(toValues(data).ranges.map((r) => r.text_ru.trim().length > 0));
    }, [data]);

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const ranges: CreditResultTextRange[] = values.ranges.map((r) => ({
                min: r.min,
                max: r.max,
                text_kz: r.text_kz.trim(),
                ...(r.text_ru.trim() !== '' ? { text_ru: r.text_ru.trim() } : {}),
            }));
            return updateCreditResultTexts(ranges);
        },
        onSuccess: (saved) => {
            toast.success(t('result_texts_saved'));
            qc.setQueryData(RESULT_TEXTS_QUERY_KEY, saved);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error && err.message ? err.message : t('generic_error'));
        },
    });

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('result_texts_title')}
                    subtitle={t('result_texts_subtitle')}
                    breadcrumbs={[{ label: t('list_title'), href: `/${locale}/credits` }, { label: t('result_texts_title') }]}
                />
            }
        >
            {isPending ? (
                <div className='max-w-2xl space-y-3'>
                    {FIXED_RANGES.map((r) => (
                        <Skeleton key={r.min} className='h-32 w-full' />
                    ))}
                </div>
            ) : (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='max-w-2xl space-y-4'>
                        {FIXED_RANGES.map((range, idx) => (
                            <Card key={range.min}>
                                <CardHeader>
                                    <CardTitle className='text-base'>
                                        {t('result_texts_range_title', { min: range.min, max: range.max })}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-3'>
                                    <FormField
                                        control={form.control}
                                        name={`ranges.${idx}.text_kz`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('result_texts_kz_label')}</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} {...field} disabled={!canEdit} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <button
                                        type='button'
                                        className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium'
                                        onClick={() => setRuOpen((prev) => prev.map((v, i) => (i === idx ? !v : v)))}
                                    >
                                        {ruOpen[idx] ? <ChevronDown className='h-3.5 w-3.5' /> : <ChevronRight className='h-3.5 w-3.5' />}
                                        {t('result_texts_ru_toggle')}
                                    </button>
                                    {ruOpen[idx] ? (
                                        <FormField
                                            control={form.control}
                                            name={`ranges.${idx}.text_ru`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('result_texts_ru_label')}</FormLabel>
                                                    <FormControl>
                                                        <Textarea rows={3} {...field} disabled={!canEdit} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ) : null}
                                </CardContent>
                            </Card>
                        ))}
                        {canEdit ? (
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving') : t('save')}
                            </Button>
                        ) : null}
                    </form>
                </Form>
            )}
        </PageShell>
    );
}
