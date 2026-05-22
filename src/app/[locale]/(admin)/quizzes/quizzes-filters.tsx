'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { QuizBadgePicker } from '@/components/quizzes/quiz-badge-picker';
import { QuizCategoryPicker } from '@/components/quizzes/quiz-category-picker';
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
 * category_id / badge_id use autocomplete pickers (Plan 03 / Plan 06) — the picker
 * fetches its own catalog and emits the picked id.
 */
export function QuizzesFilters({ value, onChange }: QuizzesFiltersProps) {
    const t = useTranslations('admin.quizzes');
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
            <div className='w-56'>
                <QuizCategoryPicker
                    value={value.category_id ?? null}
                    onChange={(id) => onChange({ ...value, category_id: id ?? undefined })}
                    placeholder={t('filter_category')}
                />
            </div>
            <div className='w-56'>
                <QuizBadgePicker
                    value={value.badge_id ?? null}
                    onChange={(id) => onChange({ ...value, badge_id: id ?? undefined })}
                    placeholder={t('filter_badge')}
                />
            </div>
        </div>
    );
}
