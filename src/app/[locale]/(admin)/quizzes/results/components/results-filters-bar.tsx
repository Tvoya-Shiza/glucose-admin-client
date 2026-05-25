'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupPicker } from '@/components/groups/group-picker';
import { QuizBadgePicker } from '@/components/quizzes/quiz-badge-picker';
import { QuizPicker } from '@/components/quizzes/quiz-picker';
import type { QuizResultStatus } from '@/lib/quizzes/types';

export interface ResultsFiltersValue {
    q?: string;
    status?: QuizResultStatus;
    /** Unix seconds. */
    date_from?: number;
    /** Unix seconds. */
    date_to?: number;
    quiz_id?: number;
    badge_id?: number;
    group_id?: number;
}

export interface ResultsFiltersBarProps {
    value: ResultsFiltersValue;
    /** Hide group picker for teacher actors. */
    showGroupFilter: boolean;
    onChange: (next: ResultsFiltersValue) => void;
}

function unixToDateInput(unix: number | undefined): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function dateInputToUnix(value: string): number | undefined {
    if (!value) return undefined;
    const ts = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ts)) return undefined;
    return Math.floor(ts / 1000);
}

/**
 * Filter bar for the QuizResults audit page. Drives both the stats query and
 * the list query above. Debounces the free-text search 300ms locally; all
 * other inputs fire onChange immediately.
 */
export function ResultsFiltersBar({ value, showGroupFilter, onChange }: ResultsFiltersBarProps) {
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
        <Card className='flex-row flex-wrap items-end gap-3 p-4'>
            <div className='flex flex-col gap-1'>
                <Label htmlFor='results-q' className='text-xs'>
                    {t('result_filter_search_label')}
                </Label>
                <Input
                    id='results-q'
                    className='w-60'
                    placeholder={t('result_filter_search_placeholder')}
                    value={qLocal}
                    onChange={(e) => setQLocal(e.target.value)}
                />
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('result_filter_status_label')}</Label>
                <Select
                    value={value.status ?? '__all__'}
                    onValueChange={(v) =>
                        onChange({
                            ...value,
                            status: v === '__all__' ? undefined : (v as QuizResultStatus),
                        })
                    }
                >
                    <SelectTrigger className='w-40'>
                        <SelectValue placeholder={t('result_filter_status_label')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='__all__'>{t('result_filter_status_all')}</SelectItem>
                        <SelectItem value='waiting'>{t('result_status_waiting')}</SelectItem>
                        <SelectItem value='passed'>{t('result_status_passed')}</SelectItem>
                        <SelectItem value='failed'>{t('result_status_failed')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className='flex flex-col gap-1'>
                <Label htmlFor='results-date-from' className='text-xs'>
                    {t('result_filter_date_from')}
                </Label>
                <Input
                    id='results-date-from'
                    type='date'
                    className='w-40'
                    value={unixToDateInput(value.date_from)}
                    onChange={(e) => onChange({ ...value, date_from: dateInputToUnix(e.target.value) })}
                />
            </div>

            <div className='flex flex-col gap-1'>
                <Label htmlFor='results-date-to' className='text-xs'>
                    {t('result_filter_date_to')}
                </Label>
                <Input
                    id='results-date-to'
                    type='date'
                    className='w-40'
                    value={unixToDateInput(value.date_to)}
                    onChange={(e) => onChange({ ...value, date_to: dateInputToUnix(e.target.value) })}
                />
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('filter_quiz')}</Label>
                <div className='w-60'>
                    <QuizPicker
                        value={value.quiz_id ?? null}
                        onChange={(id) => onChange({ ...value, quiz_id: id ?? undefined })}
                        placeholder={t('filter_quiz')}
                    />
                </div>
            </div>

            <div className='flex flex-col gap-1'>
                <Label className='text-xs'>{t('result_filter_badge_id')}</Label>
                <div className='w-56'>
                    <QuizBadgePicker
                        value={value.badge_id ?? null}
                        onChange={(id) => onChange({ ...value, badge_id: id ?? undefined })}
                    />
                </div>
            </div>

            {showGroupFilter ? (
                <div className='flex flex-col gap-1'>
                    <Label className='text-xs'>{t('filter_group')}</Label>
                    <div className='w-56'>
                        <GroupPicker
                            value={value.group_id ?? null}
                            onChange={(id) => onChange({ ...value, group_id: id ?? undefined })}
                        />
                    </div>
                </div>
            ) : null}
        </Card>
    );
}
