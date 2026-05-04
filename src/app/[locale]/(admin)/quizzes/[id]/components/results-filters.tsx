'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
}

export interface ResultsFiltersProps {
    value: ResultsFiltersValue;
    /**
     * When false, hide the quiz_id + badge_id inputs (per-quiz scoped tab use).
     * When true, the standalone admin audit page shows them.
     */
    showQuizFilter: boolean;
    onChange: (next: ResultsFiltersValue) => void;
}

/**
 * Convert Unix seconds → 'YYYY-MM-DD' for `<input type='date'>`.
 * Returns empty string when value is falsy.
 */
function unixToDateInput(unix: number | undefined): string {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** Parse 'YYYY-MM-DD' → Unix seconds (UTC midnight). Returns undefined on empty/bad input. */
function dateInputToUnix(value: string): number | undefined {
    if (!value) return undefined;
    const ts = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ts)) return undefined;
    return Math.floor(ts / 1000);
}

/**
 * Filter bar for the QuizResults list (Plan 07).
 *
 * Mirrors `QuizzesFilters` ergonomics:
 *   - Local state for debounced text/numeric inputs (300ms).
 *   - shadcn `<Select>` doesn't accept empty string values → '__all__' sentinel.
 *
 * Date inputs are native `<input type='date'>` (no shadcn date-picker vendored
 * yet; matches Phase 5 courses filter posture). Values are stored as Unix seconds
 * in URL state and converted at the boundary.
 */
export function ResultsFilters({ value, showQuizFilter, onChange }: ResultsFiltersProps) {
    const t = useTranslations('admin.quizzes');
    const [qLocal, setQLocal] = useState(value.q ?? '');
    const [quizIdLocal, setQuizIdLocal] = useState(value.quiz_id ? String(value.quiz_id) : '');
    const [badgeIdLocal, setBadgeIdLocal] = useState(value.badge_id ? String(value.badge_id) : '');

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
        if (!showQuizFilter) return;
        const id = setTimeout(() => {
            const parsed = quizIdLocal.trim() === '' ? undefined : Number(quizIdLocal.trim());
            const next = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.quiz_id ?? undefined) !== next) {
                onChange({ ...value, quiz_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizIdLocal]);

    useEffect(() => {
        if (!showQuizFilter) return;
        const id = setTimeout(() => {
            const parsed = badgeIdLocal.trim() === '' ? undefined : Number(badgeIdLocal.trim());
            const next = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
            if ((value.badge_id ?? undefined) !== next) {
                onChange({ ...value, badge_id: next });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [badgeIdLocal]);

    return (
        <div className='flex flex-wrap items-end gap-3 border-b pb-3'>
            <div className='flex flex-col gap-1'>
                <Label htmlFor='results-q' className='text-xs'>
                    {t('result_filter_search_label')}
                </Label>
                <Input
                    id='results-q'
                    className='w-64'
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
                    <SelectTrigger className='w-44'>
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
                    onChange={(e) =>
                        onChange({ ...value, date_from: dateInputToUnix(e.target.value) })
                    }
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
                    onChange={(e) =>
                        onChange({ ...value, date_to: dateInputToUnix(e.target.value) })
                    }
                />
            </div>

            {showQuizFilter ? (
                <>
                    <div className='flex flex-col gap-1'>
                        <Label htmlFor='results-quiz-id' className='text-xs'>
                            {t('result_filter_quiz_id')}
                        </Label>
                        <Input
                            id='results-quiz-id'
                            className='w-32'
                            inputMode='numeric'
                            placeholder='#'
                            value={quizIdLocal}
                            onChange={(e) => setQuizIdLocal(e.target.value.replace(/[^\d]/g, ''))}
                        />
                    </div>
                    <div className='flex flex-col gap-1'>
                        <Label htmlFor='results-badge-id' className='text-xs'>
                            {t('result_filter_badge_id')}
                        </Label>
                        <Input
                            id='results-badge-id'
                            className='w-32'
                            inputMode='numeric'
                            placeholder='#'
                            value={badgeIdLocal}
                            onChange={(e) => setBadgeIdLocal(e.target.value.replace(/[^\d]/g, ''))}
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}
