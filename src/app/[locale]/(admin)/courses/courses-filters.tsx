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
import type { CourseStatus, TranslationCompleteness } from '@/lib/courses/types';

export interface CoursesFiltersValue {
    q?: string;
    status?: CourseStatus;
    teacher_id?: number;
    category_id?: number;
    translation_completeness?: TranslationCompleteness;
}

export interface CoursesFiltersProps {
    value: CoursesFiltersValue;
    onChange: (next: CoursesFiltersValue) => void;
    /** Hide the teacher filter for non-admin actors (teachers are scoped to own courses). */
    showTeacherFilter: boolean;
}

/**
 * Top filter bar (CONTEXT D-02) — debounced search + status / teacher / category /
 * translation-completeness selects.
 *
 * Search debounces 300ms locally; selects fire onChange immediately. shadcn `<Select>`
 * doesn't accept empty-string values, so we use the sentinel '__all__' for "no filter"
 * and convert at the boundary.
 *
 * teacher_id and category_id are numeric text fields for now — autocomplete pickers
 * are deferred (per Phase 4 carry-over precedent). Empty input clears the filter.
 */
export function CoursesFilters({ value, onChange, showTeacherFilter }: CoursesFiltersProps) {
    const t = useTranslations('admin.courses');
    const [qLocal, setQLocal] = useState(value.q ?? '');
    const [teacherLocal, setTeacherLocal] = useState(
        value.teacher_id ? String(value.teacher_id) : '',
    );
    const [categoryLocal, setCategoryLocal] = useState(
        value.category_id ? String(value.category_id) : '',
    );

    // Debounce q at 300ms (D-02). Dependency intentionally narrow.
    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.q ?? '') !== qLocal) {
                onChange({ ...value, q: qLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    useEffect(() => {
        const id = setTimeout(() => {
            const parsed = teacherLocal.trim() === '' ? undefined : Number(teacherLocal.trim());
            const next =
                parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.teacher_id ?? undefined) !== next) {
                onChange({ ...value, teacher_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teacherLocal]);

    useEffect(() => {
        const id = setTimeout(() => {
            const parsed = categoryLocal.trim() === '' ? undefined : Number(categoryLocal.trim());
            const next =
                parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.category_id ?? undefined) !== next) {
                onChange({ ...value, category_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryLocal]);

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
                    onChange({
                        ...value,
                        status: v === '__all__' ? undefined : (v as CourseStatus),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                    <SelectItem value='is_draft'>{t('status_is_draft')}</SelectItem>
                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.translation_completeness ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        translation_completeness:
                            v === '__all__' ? undefined : (v as TranslationCompleteness),
                    })
                }
            >
                <SelectTrigger className='w-48'>
                    <SelectValue placeholder={t('filter_translation_completeness')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='complete'>{t('translation_complete')}</SelectItem>
                    <SelectItem value='incomplete'>{t('translation_incomplete')}</SelectItem>
                </SelectContent>
            </Select>
            {showTeacherFilter ? (
                <Input
                    className='w-44'
                    inputMode='numeric'
                    placeholder={t('filter_teacher')}
                    value={teacherLocal}
                    onChange={(e) => setTeacherLocal(e.target.value.replace(/[^\d]/g, ''))}
                />
            ) : null}
            <Input
                className='w-44'
                inputMode='numeric'
                placeholder={t('filter_category')}
                value={categoryLocal}
                onChange={(e) => setCategoryLocal(e.target.value.replace(/[^\d]/g, ''))}
            />
        </div>
    );
}
