'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupPicker } from '@/components/groups/group-picker';
import type { CreditStatus } from '@/lib/credits/types';

export interface CreditsFiltersValue {
    q?: string;
    group_id?: number;
    status?: CreditStatus;
    /** `<input type='date'>` values (YYYY-MM-DD); converted to unix at query time. */
    date_from?: string;
    date_to?: string;
}

export interface CreditsFiltersProps {
    value: CreditsFiltersValue;
    onChange: (next: CreditsFiltersValue) => void;
}

/**
 * Credits list filter bar — debounced search + group picker + status select +
 * scheduled-date range. Mirrors quizzes-filters.tsx ('__all__' sentinel for
 * shadcn Select "no filter").
 */
export function CreditsFilters({ value, onChange }: CreditsFiltersProps) {
    const t = useTranslations('admin.credits');
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
        <div className='flex flex-wrap items-center gap-3 p-4'>
            <Input className='max-w-sm' placeholder={t('search_placeholder')} value={qLocal} onChange={(e) => setQLocal(e.target.value)} />
            <div className='w-56'>
                <GroupPicker
                    value={value.group_id ?? null}
                    onChange={(id) => onChange({ ...value, group_id: id ?? undefined })}
                    placeholder={t('filter_group')}
                />
            </div>
            <Select
                value={value.status ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        status: v === '__all__' ? undefined : (v as CreditStatus),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='draft'>{t('status_draft')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='archived'>{t('status_archived')}</SelectItem>
                </SelectContent>
            </Select>
            <div className='flex items-center gap-2'>
                <span className='text-muted-foreground text-xs'>{t('filter_date_from')}</span>
                <Input
                    type='date'
                    className='w-40'
                    value={value.date_from ?? ''}
                    onChange={(e) => onChange({ ...value, date_from: e.target.value || undefined })}
                />
                <span className='text-muted-foreground text-xs'>{t('filter_date_to')}</span>
                <Input
                    type='date'
                    className='w-40'
                    value={value.date_to ?? ''}
                    onChange={(e) => onChange({ ...value, date_to: e.target.value || undefined })}
                />
            </div>
        </div>
    );
}
