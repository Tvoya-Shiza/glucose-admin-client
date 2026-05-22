'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { listBadges } from '@/lib/quizzes/api';
import type { QuizBadgeRow } from '@/lib/quizzes/types';

export interface QuizBadgePickerProps {
    value: number | null;
    onChange: (id: number | null, badge: QuizBadgeRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** If set, only badges matching this is_active flag are shown. */
    activeOnly?: boolean;
}

/**
 * Picker for QuizBadge rows. Like `QuizCategoryPicker`, fetches the full list
 * once and filters client-side. Total badges are small (< 50 prod) so this is
 * cheaper than wiring server-side search.
 */
export function QuizBadgePicker({ value, onChange, placeholder, disabled, activeOnly }: QuizBadgePickerProps) {
    const t = useTranslations('admin.quizzes');

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const query = useQuery({
        queryKey: ['admin.quiz-badges.list'],
        queryFn: listBadges,
        enabled: !disabled,
        staleTime: 60_000,
    });

    const labelOf = (b: QuizBadgeRow): string => b.translations.kz ?? b.translations.ru ?? `#${b.id}`;

    const filtered = useMemo(() => {
        let rows = query.data ?? [];
        if (activeOnly) rows = rows.filter((b) => b.is_active);
        if (debouncedQuery !== '') {
            rows = rows.filter((b) => labelOf(b).toLowerCase().includes(debouncedQuery));
        }
        return rows;
    }, [query.data, debouncedQuery, activeOnly]);

    const selected = useMemo(() => {
        if (value == null) return null;
        return (query.data ?? []).find((b) => b.id === value) ?? null;
    }, [query.data, value]);

    const displayValue = open ? searchQuery : selected ? labelOf(selected) : value != null ? `#${value}` : '';

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
                placeholder={placeholder ?? t('filter_badge')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && !disabled ? (
                <div className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {query.isLoading ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('loading')}</p>
                    ) : filtered.length === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('badges_empty')}</p>
                    ) : (
                        <>
                            <button
                                type='button'
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onChange(null, null);
                                    setSearchQuery('');
                                    setOpen(false);
                                }}
                                className='flex w-full items-center px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted'
                            >
                                {t('filter_all')}
                            </button>
                            {filtered.map((b) => {
                                const isSelected = value === b.id;
                                return (
                                    <button
                                        key={b.id}
                                        type='button'
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            onChange(b.id, b);
                                            setSearchQuery('');
                                            setOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                            isSelected ? 'bg-muted' : ''
                                        }`}
                                    >
                                        <span className='truncate'>{labelOf(b)}</span>
                                        <span className='text-xs text-muted-foreground'>
                                            {b.is_active ? `#${b.id}` : `#${b.id} · ${t('badge_inactive')}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
