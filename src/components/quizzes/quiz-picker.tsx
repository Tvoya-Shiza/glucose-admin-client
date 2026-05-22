'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { getQuiz, listQuizzes } from '@/lib/quizzes/api';
import type { QuizRow } from '@/lib/quizzes/types';

export interface QuizPickerProps {
    value: number | null;
    onChange: (id: number | null, quiz: QuizRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Fallback display label when value is set but the row has not loaded yet. */
    initialLabel?: string | null;
}

/**
 * Searchable quiz picker — mirrors the GroupPicker pattern (server-side
 * debounced search via `listQuizzes`, single `getQuiz(value)` for label
 * resolution). Replaces the bare numeric `quiz_id` input on the Quiz Results
 * audit page.
 */
export function QuizPicker({ value, onChange, placeholder, disabled, initialLabel }: QuizPickerProps) {
    const t = useTranslations('admin.quizzes');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const list = useQuery({
        queryKey: ['admin.quizzes.picker', { q: debouncedQuery }],
        queryFn: () => listQuizzes({ q: debouncedQuery || undefined, page_size: 10 }),
        enabled: open && !disabled,
        staleTime: 30_000,
    });

    const selected = useQuery({
        queryKey: ['admin.quizzes.detail-picker', value],
        queryFn: () => (value != null ? getQuiz(value) : Promise.resolve(null)),
        enabled: value != null && !disabled,
        staleTime: 60_000,
    });

    const candidates: QuizRow[] = useMemo(() => list.data?.rows ?? [], [list.data]);

    const selectedLabel = useMemo(() => {
        if (value == null) return '';
        const fromList = candidates.find((q) => q.id === value);
        if (fromList?.title_kz) return fromList.title_kz;
        const detailTitleKz =
            selected.data && 'title_kz' in selected.data
                ? (selected.data as { title_kz?: string | null }).title_kz
                : null;
        if (detailTitleKz) return detailTitleKz;
        if (initialLabel) return initialLabel;
        return `#${value}`;
    }, [candidates, selected.data, value, initialLabel]);

    const displayValue = open ? searchQuery : value != null ? selectedLabel : '';

    return (
        <div className='relative'>
            <Input
                value={displayValue}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!open) setOpen(true);
                    if (e.target.value === '' && value != null) {
                        onChange(null, null);
                    }
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder ?? t('filter_quiz')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && !disabled ? (
                <div className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {list.isFetching ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('loading')}</p>
                    ) : candidates.length === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('no_quizzes')}</p>
                    ) : (
                        candidates.map((q) => {
                            const isSel = value === q.id;
                            const label = q.title_kz?.trim() || `#${q.id}`;
                            return (
                                <button
                                    key={q.id}
                                    type='button'
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onChange(q.id, q);
                                        setSearchQuery('');
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                        isSel ? 'bg-muted' : ''
                                    }`}
                                >
                                    <span className='truncate'>{label}</span>
                                    <span className='text-xs text-muted-foreground'>#{q.id}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}
