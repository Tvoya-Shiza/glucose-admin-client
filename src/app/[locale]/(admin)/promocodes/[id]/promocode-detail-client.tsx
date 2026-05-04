'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPromocode, updatePromocode } from '@/lib/promocodes/api';
import type { PromocodeDetail } from '@/lib/promocodes/types';
import { UpsertPromocodeDialog } from '../components/upsert-promocode-dialog';
import { UsagesTable } from './usages-table';

export interface PromocodeDetailClientProps {
    promocodeId: number;
}

function formatUnixSecondsOrDash(value: number | null | undefined, locale: 'ru' | 'kz'): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

function windowStatus(
    now: number,
    start_date: number,
    expires_at: number,
    is_active: boolean,
): 'active' | 'expired' | 'future' | 'inactive' {
    if (!is_active) return 'inactive';
    if (now < start_date) return 'future';
    if (now > expires_at) return 'expired';
    return 'active';
}

/**
 * PRM-01 / PRM-02 — promocode detail page.
 *
 * Two tabs:
 *   - **Overview:** read-only summary card + Edit button (opens UpsertPromocodeDialog
 *     pre-filled with the loaded detail). Inline "Активен" toggle bumps `is_active`
 *     via PATCH updatePromocode.
 *   - **Usages:** PRM-02 — paginated PromocodeUsage rows joined to user.
 *
 * Cache invalidation: ['admin.promocodes.detail', id] and ['admin.promocodes.list']
 * on any save.
 */
export function PromocodeDetailClient({ promocodeId }: PromocodeDetailClientProps) {
    const t = useTranslations('admin.promocodes');
    const locale = useLocale() as 'ru' | 'kz';
    const qc = useQueryClient();

    const detail = useQuery({
        queryKey: ['admin.promocodes.detail', promocodeId],
        queryFn: () => getPromocode(promocodeId),
        staleTime: 30_000,
    });

    const promocode: PromocodeDetail | undefined = detail.data;
    const [editOpen, setEditOpen] = useState(false);

    const toggleActive = useMutation({
        mutationFn: () => {
            if (!promocode) throw new Error('detail_not_loaded');
            return updatePromocode(promocode.id, {
                code: promocode.code,
                title: promocode.title,
                description: promocode.description,
                discount_type: promocode.discount_type,
                discount_value: promocode.discount_value,
                max_discount_amount: promocode.max_discount_amount,
                minimum_order_amount: promocode.minimum_order_amount,
                usage_limit: promocode.usage_limit,
                usage_limit_per_user: promocode.usage_limit_per_user,
                is_active: !promocode.is_active,
                start_date: promocode.start_date,
                expires_at: promocode.expires_at,
                applicable_to: promocode.applicable_to,
                first_purchase_only: promocode.first_purchase_only,
                region_id: promocode.region_id,
            });
        },
        onSuccess: () => {
            toast.success(t('updated_toast'));
            qc.invalidateQueries({ queryKey: ['admin.promocodes.detail', promocodeId], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.promocodes.list'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    if (detail.isLoading) {
        return (
            <div className='flex flex-col gap-4 p-6'>
                <Skeleton className='h-8 w-64' />
                <Skeleton className='h-32 w-full' />
                <Skeleton className='h-64 w-full' />
            </div>
        );
    }

    if (detail.isError || !promocode) {
        return (
            <div className='p-6 text-sm text-destructive'>
                {(detail.error as Error)?.message ?? t('error_generic')}
            </div>
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const ws = windowStatus(now, promocode.start_date, promocode.expires_at, promocode.is_active);

    return (
        <div className='flex h-full flex-col'>
            <header className='flex items-center justify-between border-b p-6'>
                <div>
                    <div className='flex items-center gap-2'>
                        <Button asChild variant='ghost' size='sm'>
                            <Link href={`/${locale}/promocodes`}>‹ {t('list_title')}</Link>
                        </Button>
                    </div>
                    <h1 className='mt-2 flex items-center gap-2 text-2xl font-semibold'>
                        <span className='font-mono'>{promocode.code}</span>
                        <Badge
                            variant={
                                ws === 'active'
                                    ? 'default'
                                    : ws === 'expired'
                                      ? 'destructive'
                                      : ws === 'future'
                                        ? 'secondary'
                                        : 'outline'
                            }
                        >
                            {t(`status_${ws}`)}
                        </Badge>
                    </h1>
                    <p className='text-muted-foreground text-sm'>{promocode.title ?? '—'}</p>
                </div>
                <div className='flex items-center gap-2'>
                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => toggleActive.mutate()}
                        disabled={toggleActive.isPending}
                    >
                        {promocode.is_active ? t('status_inactive') : t('status_active')}
                    </Button>
                    <Button onClick={() => setEditOpen(true)}>{t('edit')}</Button>
                </div>
            </header>

            <Tabs defaultValue='overview' className='flex-1'>
                <TabsList className='mx-6 mt-4'>
                    <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                    <TabsTrigger value='usages'>
                        {t('usages_tab')}{' '}
                        <span className='ml-2 text-xs text-muted-foreground tabular-nums'>
                            ({promocode.usage_count})
                        </span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value='overview' className='p-6'>
                    <div className='grid grid-cols-2 gap-4 text-sm'>
                        <Field label={t('col_id')} value={String(promocode.id)} mono />
                        <Field label={t('col_code')} value={promocode.code} mono />
                        <Field label={t('form_title_label')} value={promocode.title ?? '—'} />
                        <Field label={t('form_description_label')} value={promocode.description ?? '—'} />
                        <Field
                            label={t('discount_type_label')}
                            value={t(`discount_type_${promocode.discount_type}`)}
                        />
                        <Field
                            label={t('form_discount_value_label')}
                            value={
                                promocode.discount_type === 'percentage'
                                    ? `${promocode.discount_value}%`
                                    : `${promocode.discount_value} ₸`
                            }
                        />
                        <Field
                            label={t('form_max_discount_amount_label')}
                            value={promocode.max_discount_amount ?? '—'}
                        />
                        <Field
                            label={t('form_minimum_order_amount_label')}
                            value={promocode.minimum_order_amount ?? '—'}
                        />
                        <Field
                            label={t('form_usage_limit_label')}
                            value={promocode.usage_limit != null ? String(promocode.usage_limit) : '∞'}
                        />
                        <Field
                            label={t('form_usage_limit_per_user_label')}
                            value={
                                promocode.usage_limit_per_user != null
                                    ? String(promocode.usage_limit_per_user)
                                    : '∞'
                            }
                        />
                        <Field
                            label={t('form_start_date_label')}
                            value={formatUnixSecondsOrDash(promocode.start_date, locale)}
                        />
                        <Field
                            label={t('form_expires_at_label')}
                            value={formatUnixSecondsOrDash(promocode.expires_at, locale)}
                        />
                        <Field
                            label={t('applicable_to_label')}
                            value={
                                promocode.applicable_to?.type === 'course'
                                    ? `${t('applicable_to_courses')} (${promocode.applicable_to.course_ids.length})`
                                    : t('applicable_to_global')
                            }
                        />
                        <Field
                            label={t('form_first_purchase_only_label')}
                            value={promocode.first_purchase_only ? '✓' : '—'}
                        />
                        <Field
                            label={t('col_usage_count')}
                            value={String(promocode.usage_count)}
                        />
                        <Field
                            label={t('col_created_at')}
                            value={formatUnixSecondsOrDash(promocode.created_at, locale)}
                        />
                    </div>
                </TabsContent>
                <TabsContent value='usages' className='p-6'>
                    <UsagesTable promocodeId={promocode.id} />
                </TabsContent>
            </Tabs>

            <UpsertPromocodeDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                promocode={promocode}
            />
        </div>
    );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className='space-y-1'>
            <div className='text-xs uppercase text-muted-foreground'>{label}</div>
            <div className={mono ? 'font-mono' : ''}>{value}</div>
        </div>
    );
}
