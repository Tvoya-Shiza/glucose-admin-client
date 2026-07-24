'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { QuizCategoryPicker } from '@/components/quizzes/quiz-category-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TrainerPublishStatus } from '@/lib/trainers/types';

export interface TrainersFiltersValue {
    q?: string;
    publish_status?: TrainerPublishStatus;
    category_id?: number;
}

export interface TrainersFiltersProps {
    value: TrainersFiltersValue;
    onChange: (next: TrainersFiltersValue) => void;
}

/**
 * Trainer list filter bar — debounced search + publish-status select + category
 * picker. Mirrors QuizzesFilters ergonomics: search debounces 300ms locally,
 * selects fire immediately, shadcn `<Select>` uses the '__all__' sentinel for
 * "no filter" (empty-string values are rejected by Radix Select).
 *
 * The category picker reuses the quiz-category surface — trainer categories ARE
 * quiz categories (a trainer's category_id points at QuizCategory).
 */
export function TrainersFilters({ value, onChange }: TrainersFiltersProps) {
    const t = useTranslations('admin.trainers');
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
            <Input className='max-w-sm' placeholder={t('search_placeholder')} value={qLocal} onChange={(e) => setQLocal(e.target.value)} />
            <Select
                value={value.publish_status ?? '__all__'}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        publish_status: v === '__all__' ? undefined : (v as TrainerPublishStatus),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_publish_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='public'>{t('status_public')}</SelectItem>
                    <SelectItem value='hidden'>{t('status_hidden')}</SelectItem>
                </SelectContent>
            </Select>
            <div className='w-56'>
                <QuizCategoryPicker
                    value={value.category_id ?? null}
                    onChange={(id) => onChange({ ...value, category_id: id ?? undefined })}
                    placeholder={t('filter_category')}
                    allowInlineCreate={false}
                />
            </div>
        </div>
    );
}
