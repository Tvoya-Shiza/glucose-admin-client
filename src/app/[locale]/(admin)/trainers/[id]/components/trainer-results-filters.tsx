'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoursePicker } from '@/components/courses/course-picker';
import { GroupPicker } from '@/components/groups/group-picker';
import type { TrainerAttemptStatus, TrainerResultsSortField } from '@/lib/trainers/types';

export interface TrainerResultsFiltersValue {
    q?: string;
    group_id?: number;
    /** ТЗ 5.6 — фильтр по курсу (через trainer_courses). */
    course_id?: number;
    status?: TrainerAttemptStatus;
    /** Unix seconds (on finished_at). */
    date_from?: number;
    /** Unix seconds (on finished_at). */
    date_to?: number;
    /** ТЗ 5.6 — сортировка выдачи. */
    sort?: TrainerResultsSortField;
    order?: 'asc' | 'desc';
}

export interface TrainerResultsFiltersProps {
    value: TrainerResultsFiltersValue;
    onChange: (next: TrainerResultsFiltersValue) => void;
}

/** Unix seconds → 'YYYY-MM-DD' for `<input type='date'>` ('' when falsy). */
function unixToDateInput(unix: number | undefined): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** 'YYYY-MM-DD' → Unix seconds (UTC midnight). undefined on empty/bad input. */
function dateInputToUnix(value: string): number | undefined {
    if (!value) return undefined;
    const ts = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(ts) ? undefined : Math.floor(ts / 1000);
}

/**
 * Filter bar for the trainer results list (ТЗ §5.6): search (student full_name /
 * mobile), group picker, status select, and a finished_at date range. Mirrors the
 * quizzes ResultsFilters ergonomics — 300ms debounced text, '__all__' sentinel for
 * the status select, native date inputs storing Unix seconds at the boundary.
 */
export function TrainerResultsFilters({ value, onChange }: TrainerResultsFiltersProps) {
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
        <div className='flex flex-wrap items-end gap-3 border-b pb-3'>
            <div className='flex flex-col gap-1'>
                <Label htmlFor='tr-results-q' className='text-xs'>
                    {t('results_search_label')}
                </Label>
                <Input
                    id='tr-results-q'
                    className='w-64'
                    placeholder={t('results_search_placeholder')}
                    value={qLocal}
                    onChange={(e) => setQLocal(e.target.value)}
                />
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('results_group_label')}</Label>
                <div className='w-56'>
                    <GroupPicker
                        value={value.group_id ?? null}
                        onChange={(id) => onChange({ ...value, group_id: id ?? undefined })}
                        placeholder={t('results_group_placeholder')}
                    />
                </div>
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('results_course_label')}</Label>
                <div className='w-56'>
                    <CoursePicker
                        value={value.course_id ?? null}
                        onChange={(id) => onChange({ ...value, course_id: id ?? undefined })}
                        placeholder={t('results_course_placeholder')}
                    />
                </div>
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('results_sort_label')}</Label>
                <Select
                    value={`${value.sort ?? 'started_at'}:${value.order ?? 'desc'}`}
                    onValueChange={(v) => {
                        const [sort, order] = v.split(':') as [TrainerResultsSortField, 'asc' | 'desc'];
                        onChange({ ...value, sort, order });
                    }}
                >
                    <SelectTrigger className='w-52'>
                        <SelectValue placeholder={t('results_sort_label')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='started_at:desc'>{t('results_sort_date_desc')}</SelectItem>
                        <SelectItem value='started_at:asc'>{t('results_sort_date_asc')}</SelectItem>
                        <SelectItem value='score:desc'>{t('results_sort_score_desc')}</SelectItem>
                        <SelectItem value='score:asc'>{t('results_sort_score_asc')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('results_status_label')}</Label>
                <Select
                    value={value.status ?? '__all__'}
                    onValueChange={(v) => onChange({ ...value, status: v === '__all__' ? undefined : (v as TrainerAttemptStatus) })}
                >
                    <SelectTrigger className='w-44'>
                        <SelectValue placeholder={t('results_status_label')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='__all__'>{t('results_status_all')}</SelectItem>
                        <SelectItem value='in_progress'>{t('attempt_status_in_progress')}</SelectItem>
                        <SelectItem value='paused'>{t('attempt_status_paused')}</SelectItem>
                        <SelectItem value='finished'>{t('attempt_status_finished')}</SelectItem>
                        <SelectItem value='abandoned'>{t('attempt_status_abandoned')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className='flex flex-col gap-1'>
                <Label htmlFor='tr-results-from' className='text-xs'>
                    {t('results_date_from')}
                </Label>
                <Input
                    id='tr-results-from'
                    type='date'
                    className='w-40'
                    value={unixToDateInput(value.date_from)}
                    onChange={(e) => onChange({ ...value, date_from: dateInputToUnix(e.target.value) })}
                />
            </div>

            <div className='flex flex-col gap-1'>
                <Label htmlFor='tr-results-to' className='text-xs'>
                    {t('results_date_to')}
                </Label>
                <Input
                    id='tr-results-to'
                    type='date'
                    className='w-40'
                    value={unixToDateInput(value.date_to)}
                    onChange={(e) => onChange({ ...value, date_to: dateInputToUnix(e.target.value) })}
                />
            </div>
        </div>
    );
}
