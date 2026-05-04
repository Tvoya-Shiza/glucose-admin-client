'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { DiscountType } from '@/lib/promocodes/types';

export type StatusWindow = 'active' | 'expired' | 'future' | 'all';

export interface PromocodesFiltersValue {
    q?: string;
    discount_type?: DiscountType;
    status_window?: StatusWindow;
    is_active?: boolean;
}

export interface PromocodesFiltersProps {
    value: PromocodesFiltersValue;
    onChange: (next: PromocodesFiltersValue) => void;
}

const ALL = '__all__';

/**
 * PRM-01 — top filter bar: search + discount_type + status_window + is_active.
 *
 * Search debounces 300ms locally (D-03). status_window selects between active /
 * expired / future / all; the server computes the window against `Math.floor(Date.now()/1000)`.
 */
export function PromocodesFilters({ value, onChange }: PromocodesFiltersProps) {
    const t = useTranslations('admin.promocodes');
    const [qLocal, setQLocal] = useState(value.q ?? '');

    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.q ?? '') !== qLocal) {
                onChange({ ...value, q: qLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3 border-b p-4'>
            <Input
                className='max-w-sm'
                placeholder={t('search_placeholder')}
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
            />
            <Select
                value={value.discount_type ?? ALL}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        discount_type: v === ALL ? undefined : (v as DiscountType),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_discount_type')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value='percentage'>{t('discount_type_percentage')}</SelectItem>
                    <SelectItem value='fixed'>{t('discount_type_fixed')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.status_window ?? 'all'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        status_window: v === 'all' ? undefined : (v as StatusWindow),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='all'>{t('filter_all')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='expired'>{t('status_expired')}</SelectItem>
                    <SelectItem value='future'>{t('status_future')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={
                    value.is_active === undefined ? ALL : value.is_active ? 'true' : 'false'
                }
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        is_active: v === ALL ? undefined : v === 'true',
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_active_only')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value='true'>{t('status_active')}</SelectItem>
                    <SelectItem value='false'>{t('status_inactive')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
