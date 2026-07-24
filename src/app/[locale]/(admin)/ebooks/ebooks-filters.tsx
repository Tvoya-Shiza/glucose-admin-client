'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PublisherSelect } from '@/components/ebooks/publisher-select';
import type { BookStatus } from '@/lib/ebooks/types';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export interface EbooksFiltersValue {
    q?: string;
    status?: BookStatus;
    subject_id?: number;
    publisher_id?: number;
    grade?: number;
}

export interface EbooksFiltersProps {
    value: EbooksFiltersValue;
    onChange: (next: EbooksFiltersValue) => void;
}

/**
 * Ebook list filter bar — debounced search + status / publisher / grade selects
 * + a numeric subject id field. Mirrors TrainersFilters ergonomics: search
 * debounces 300ms locally, selects fire immediately, shadcn `<Select>` uses the
 * '__all__' sentinel for "no filter" (empty-string values are rejected by Radix).
 *
 * `subject_id` is a raw number input, NOT a picker: admin-api exposes no
 * quiz-subjects listing endpoint (Book.subject_id → QuizSubject, but there is no
 * GET /quiz-subjects), so there is nothing to populate a dropdown from. Same
 * reason the metadata form takes a numeric subject id.
 */
export function EbooksFilters({ value, onChange }: EbooksFiltersProps) {
    const t = useTranslations('admin.ebooks');
    const [qLocal, setQLocal] = useState(value.q ?? '');
    const [subjectLocal, setSubjectLocal] = useState(value.subject_id != null ? String(value.subject_id) : '');

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
            const next = subjectLocal.trim() === '' ? undefined : Number(subjectLocal);
            if ((value.subject_id ?? undefined) !== next) {
                onChange({ ...value, subject_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subjectLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3 border-b p-4'>
            <Input className='max-w-sm' placeholder={t('search_placeholder')} value={qLocal} onChange={(e) => setQLocal(e.target.value)} />

            <Select
                value={value.status ?? '__all__'}
                onValueChange={(v) => onChange({ ...value, status: v === '__all__' ? undefined : (v as BookStatus) })}
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    <SelectItem value='draft'>{t('status_draft')}</SelectItem>
                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                </SelectContent>
            </Select>

            <PublisherSelect
                className='w-52'
                value={value.publisher_id ?? null}
                onChange={(id) => onChange({ ...value, publisher_id: id ?? undefined })}
                placeholder={t('filter_publisher')}
            />

            <Select
                value={value.grade != null ? String(value.grade) : '__all__'}
                onValueChange={(v) => onChange({ ...value, grade: v === '__all__' ? undefined : Number(v) })}
            >
                <SelectTrigger className='w-36'>
                    <SelectValue placeholder={t('filter_grade')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value='__all__'>{t('filter_all')}</SelectItem>
                    {GRADES.map((g) => (
                        <SelectItem key={g} value={String(g)}>
                            {t('grade_value', { grade: g })}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Input
                className='w-36'
                inputMode='numeric'
                placeholder={t('filter_subject')}
                value={subjectLocal}
                onChange={(e) => setSubjectLocal(e.target.value.replace(/[^\d]/g, ''))}
            />
        </div>
    );
}
