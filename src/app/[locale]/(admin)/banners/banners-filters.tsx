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
import type { BannerStatus } from '@/lib/banners/types';

export interface BannersFiltersValue {
    q?: string;
    status?: BannerStatus;
}

export interface BannersFiltersProps {
    value: BannersFiltersValue;
    onChange: (next: BannersFiltersValue) => void;
}

const ALL = '__all__';

/**
 * BAN-01 — top filter bar (search + status).
 *
 * Mirrors StoriesFilters (Plan 02). Search debounces 300ms locally (D-03).
 */
export function BannersFilters({ value, onChange }: BannersFiltersProps) {
    const t = useTranslations('admin.banners');
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
                value={value.status ?? ALL}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        status: v === ALL ? undefined : (v as BannerStatus),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                    <SelectItem value='publish'>{t('status_publish')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
