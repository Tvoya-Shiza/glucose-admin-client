'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { CreditEligibleStudent } from '@/lib/credits/types';
import type { LaunchWizardValues } from './launch-wizard-form';

export interface StepStudentsProps {
    form: UseFormReturn<LaunchWizardValues>;
    students: CreditEligibleStudent[];
    loading: boolean;
}

/**
 * Wizard step 1 — eligible-students checkbox list with search + select-all.
 * Already-passed students (and those with an active session — a guaranteed
 * launch conflict) are disabled with a badge and excluded from select-all.
 */
export function StepStudents({ form, students, loading }: StepStudentsProps) {
    const t = useTranslations('admin.credits');
    const [search, setSearch] = useState('');

    const selectableIds = useMemo(() => students.filter((s) => !s.passed && s.active_session_id == null).map((s) => s.id), [students]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return students;
        return students.filter((s) => s.full_name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q));
    }, [students, search]);

    if (loading) {
        return (
            <div className='space-y-2'>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-9 w-full' />
                ))}
            </div>
        );
    }

    return (
        <FormField
            control={form.control}
            name='student_ids'
            render={({ field }) => {
                const allSelected = selectableIds.length > 0 && selectableIds.every((id) => field.value.includes(id));
                return (
                    <FormItem className='space-y-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <Input
                                className='max-w-xs'
                                placeholder={t('students_search')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <label className='flex items-center gap-2 text-sm'>
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(v) => field.onChange(v ? selectableIds : [])}
                                    disabled={selectableIds.length === 0}
                                />
                                {t('students_select_all')}
                            </label>
                        </div>
                        {students.length === 0 ? (
                            <p className='text-muted-foreground rounded border border-dashed p-4 text-center text-sm'>
                                {t('students_empty')}
                            </p>
                        ) : (
                            <div className='max-h-72 space-y-1 overflow-auto rounded border p-2'>
                                {filtered.map((s) => {
                                    const disabled = s.passed || s.active_session_id != null;
                                    const checked = field.value.includes(s.id);
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm ${
                                                disabled ? 'opacity-60' : 'hover:bg-muted/60'
                                            }`}
                                        >
                                            <span className='flex min-w-0 items-center gap-2'>
                                                <Checkbox
                                                    checked={checked && !disabled}
                                                    disabled={disabled}
                                                    onCheckedChange={(v) =>
                                                        field.onChange(v ? [...field.value, s.id] : field.value.filter((id) => id !== s.id))
                                                    }
                                                />
                                                <span className='truncate'>{s.full_name}</span>
                                                {s.email ? <span className='text-muted-foreground truncate text-xs'>{s.email}</span> : null}
                                            </span>
                                            <span className='flex shrink-0 items-center gap-1.5'>
                                                {s.attempts_used > 0 ? (
                                                    <span className='text-muted-foreground text-xs'>
                                                        {t('attempts_used', { count: s.attempts_used })}
                                                    </span>
                                                ) : null}
                                                {s.passed ? <Badge variant='success'>{t('badge_passed')}</Badge> : null}
                                                {!s.passed && s.active_session_id != null ? (
                                                    <Badge variant='warning'>{t('badge_active_session')}</Badge>
                                                ) : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <p className='text-muted-foreground text-xs'>{t('students_selected', { count: field.value.length })}</p>
                        <FormMessage />
                    </FormItem>
                );
            }}
        />
    );
}
