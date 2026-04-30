'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GroupStatus, MemberCountBucket } from '@/lib/groups/types';

export interface GroupsFiltersValue {
    q?: string;
    status?: GroupStatus;
    supervisor_id?: number;
    member_count_bucket?: MemberCountBucket;
}

export interface GroupsFiltersProps {
    value: GroupsFiltersValue;
    onChange: (next: GroupsFiltersValue) => void;
}

/**
 * Top filter bar (D-02) — debounced search + status / supervisor / member-count selects.
 *
 * Search debounces 300ms locally; selects fire onChange immediately so changes feel
 * snappy. shadcn `<Select>` doesn't accept empty-string values, so we use the
 * sentinel '__all__' for "no filter" and convert at the boundary.
 *
 * Supervisor input is a numeric text field for now — a curator picker is a future
 * enhancement (Plan 02 explicit scope: paste/type the curator's user_id). Empty input
 * clears the filter.
 */
export function GroupsFilters({ value, onChange }: GroupsFiltersProps) {
    const t = useTranslations('admin.groups');
    const [qLocal, setQLocal] = useState(value.q ?? '');
    const [supLocal, setSupLocal] = useState(value.supervisor_id ? String(value.supervisor_id) : '');

    // Debounce q at 300ms (D-02). Dependency on `value.q` intentionally omitted so URL-state
    // changes don't echo back through the debounce loop.
    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.q ?? '') !== qLocal) {
                onChange({ ...value, q: qLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    // Debounce supervisor_id at 300ms too — same UX as search.
    useEffect(() => {
        const id = setTimeout(() => {
            const parsed = supLocal.trim() === '' ? undefined : Number(supLocal.trim());
            const next =
                parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.supervisor_id ?? undefined) !== next) {
                onChange({ ...value, supervisor_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3 border-b p-4'>
            <Input
                className='max-w-sm'
                placeholder={t('search_placeholder')}
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
            />
            <Select
                value={value.status ?? '__all__'}
                onValueChange={(v) =>
                    onChange({ ...value, status: v === '__all__' ? undefined : (v as GroupStatus) })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.member_count_bucket ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        member_count_bucket:
                            v === '__all__' ? undefined : (v as MemberCountBucket),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_member_count')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='zero'>{t('member_count_zero')}</SelectItem>
                    <SelectItem value='small'>{t('member_count_small')}</SelectItem>
                    <SelectItem value='medium'>{t('member_count_medium')}</SelectItem>
                    <SelectItem value='large'>{t('member_count_large')}</SelectItem>
                </SelectContent>
            </Select>
            <Input
                className='w-44'
                inputMode='numeric'
                placeholder={t('filter_supervisor')}
                value={supLocal}
                onChange={(e) => setSupLocal(e.target.value.replace(/[^\d]/g, ''))}
            />
        </div>
    );
}
