'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditTopicSelect } from '@/components/credits/topic-select';
import type { CreditBankStatus, CreditDifficulty } from '@/lib/credits/types';

export interface QuestionsFiltersValue {
    search?: string;
    topic_id?: string;
    include_descendants?: boolean;
    difficulty?: CreditDifficulty;
    status?: CreditBankStatus;
}

export interface QuestionsFiltersProps {
    value: QuestionsFiltersValue;
    onChange: (next: QuestionsFiltersValue) => void;
}

/**
 * Question-bank filter bar: debounced search, flat-tree topic select
 * (+ include-descendants toggle), difficulty and status selects.
 */
export function QuestionsFilters({ value, onChange }: QuestionsFiltersProps) {
    const t = useTranslations('admin.credit_questions');
    const [searchLocal, setSearchLocal] = useState(value.search ?? '');

    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.search ?? '') !== searchLocal) {
                onChange({ ...value, search: searchLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3 p-4'>
            <Input
                className='max-w-sm'
                placeholder={t('search_placeholder')}
                value={searchLocal}
                onChange={(e) => setSearchLocal(e.target.value)}
            />
            <div className='w-64'>
                <CreditTopicSelect
                    value={value.topic_id ?? null}
                    onChange={(id) => onChange({ ...value, topic_id: id ?? undefined })}
                    placeholder={t('filter_topic')}
                    emptyLabel={t('filter_all')}
                    includeArchived
                />
            </div>
            <label className='flex items-center gap-2 text-sm'>
                <Checkbox
                    checked={value.include_descendants ?? false}
                    disabled={!value.topic_id}
                    onCheckedChange={(v) => onChange({ ...value, include_descendants: !!v || undefined })}
                />
                {t('include_descendants')}
            </label>
            <Select
                value={value.difficulty ?? '__all__'}
                onValueChange={(v) => onChange({ ...value, difficulty: v === '__all__' ? undefined : (v as CreditDifficulty) })}
            >
                <SelectTrigger className='w-40'>
                    <SelectValue placeholder={t('filter_difficulty')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='A'>A</SelectItem>
                    <SelectItem value='B'>B</SelectItem>
                    <SelectItem value='C'>C</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.status ?? '__all__'}
                onValueChange={(v) => onChange({ ...value, status: v === '__all__' ? undefined : (v as CreditBankStatus) })}
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='archived'>{t('status_archived')}</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
