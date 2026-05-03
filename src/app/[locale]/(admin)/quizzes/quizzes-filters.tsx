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
import type { QuestionCountBucket, QuizStatus } from '@/lib/quizzes/types';

export interface QuizzesFiltersValue {
    q?: string;
    status?: QuizStatus;
    category_id?: number;
    badge_id?: number;
    question_count_bucket?: QuestionCountBucket;
}

export interface QuizzesFiltersProps {
    value: QuizzesFiltersValue;
    onChange: (next: QuizzesFiltersValue) => void;
}

/**
 * Top filter bar (D-02) — debounced search + status / category / badge / question-count
 * selects.
 *
 * Search debounces 300ms locally; selects fire onChange immediately. shadcn `<Select>`
 * doesn't accept empty-string values, so we use the sentinel '__all__' for "no filter"
 * and convert at the boundary.
 *
 * category_id / badge_id are numeric text inputs for now (matches Phase 5 courses
 * filter posture — autocomplete picker deferred). Plan 03 (categories) and Plan 06
 * (badges) will land their own pickers we can swap in.
 */
export function QuizzesFilters({ value, onChange }: QuizzesFiltersProps) {
    const t = useTranslations('admin.quizzes');
    const [qLocal, setQLocal] = useState(value.q ?? '');
    const [categoryLocal, setCategoryLocal] = useState(
        value.category_id ? String(value.category_id) : '',
    );
    const [badgeLocal, setBadgeLocal] = useState(value.badge_id ? String(value.badge_id) : '');

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
            const parsed = categoryLocal.trim() === '' ? undefined : Number(categoryLocal.trim());
            const next = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.category_id ?? undefined) !== next) {
                onChange({ ...value, category_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryLocal]);

    useEffect(() => {
        const id = setTimeout(() => {
            const parsed = badgeLocal.trim() === '' ? undefined : Number(badgeLocal.trim());
            const next = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.badge_id ?? undefined) !== next) {
                onChange({ ...value, badge_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [badgeLocal]);

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
                        status: v === '__all__' ? undefined : (v as QuizStatus),
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
                </SelectContent>
            </Select>
            <Select
                value={value.question_count_bucket ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        question_count_bucket:
                            v === '__all__' ? undefined : (v as QuestionCountBucket),
                    })
                }
            >
                <SelectTrigger className='w-48'>
                    <SelectValue placeholder={t('filter_question_count')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='none'>{t('question_count_none')}</SelectItem>
                    <SelectItem value='1-10'>{t('question_count_1_10')}</SelectItem>
                    <SelectItem value='11-30'>{t('question_count_11_30')}</SelectItem>
                    <SelectItem value='31+'>{t('question_count_31_plus')}</SelectItem>
                </SelectContent>
            </Select>
            <Input
                className='w-40'
                inputMode='numeric'
                placeholder={t('filter_category')}
                value={categoryLocal}
                onChange={(e) => setCategoryLocal(e.target.value.replace(/[^\d]/g, ''))}
            />
            <Input
                className='w-44'
                inputMode='numeric'
                placeholder={t('filter_badge')}
                value={badgeLocal}
                onChange={(e) => setBadgeLocal(e.target.value.replace(/[^\d]/g, ''))}
            />
        </div>
    );
}
