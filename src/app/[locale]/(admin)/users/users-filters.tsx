'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface UsersFiltersValue {
    q?: string;
    role_name?: string;
    status?: 'active' | 'inactive' | 'pending';
}

export interface UsersFiltersProps {
    value: UsersFiltersValue;
    onChange: (next: UsersFiltersValue) => void;
}

/**
 * Top filter bar (D-04) — debounced search + role/status selects.
 *
 * Search input debounces 300ms locally; role/status fire onChange immediately so
 * select changes feel snappy. shadcn `<Select>` doesn't accept empty-string values,
 * so we use the sentinel '__all__' for "no filter" and convert at the boundary.
 */
export function UsersFilters({ value, onChange }: UsersFiltersProps) {
    const t = useTranslations('admin.users');
    const [qLocal, setQLocal] = useState(value.q ?? '');

    // Debounce q at 300ms (D-04). The dependency on `value.q` is intentionally omitted
    // so external (URL-state) changes don't echo back through the debounce loop.
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
                value={value.role_name ?? '__all__'}
                onValueChange={(v) => onChange({ ...value, role_name: v === '__all__' ? undefined : v })}
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_role')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='admin'>{t('role_admin')}</SelectItem>
                    <SelectItem value='curator'>{t('role_curator')}</SelectItem>
                    <SelectItem value='teacher'>{t('role_teacher')}</SelectItem>
                    <SelectItem value='student'>{t('role_student')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.status ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        status: v === '__all__' ? undefined : (v as 'active' | 'inactive' | 'pending'),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                    <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
