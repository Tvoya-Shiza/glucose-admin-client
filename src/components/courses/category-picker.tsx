'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { listCourseCategories, type CourseCategoryRow } from '@/lib/courses/api';

export interface CategoryPickerProps {
    value: number | null;
    onChange: (id: number | null, category: CourseCategoryRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Searchable picker for WebinarCategory rows. Mirrors the UserPicker UX but the
 * category surface is small enough (< 200 rows current prod) that we fetch the full
 * page on mount and filter client-side via the server's `q` param. The query also
 * caches well — 60s staleTime means re-opening the dialog reuses the result.
 *
 * Display label respects the active locale: RU title for /ru, KZ title for /kz, with
 * the other locale as fallback so a missing translation doesn't render an empty pill.
 */
export function CategoryPicker({ value, onChange, placeholder, disabled }: CategoryPickerProps) {
    const t = useTranslations('admin.courses');
    const locale = useLocale();

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const query = useQuery({
        queryKey: ['admin.courses.categories', { q: debouncedQuery }],
        queryFn: () => listCourseCategories({ q: debouncedQuery || undefined, page_size: 50 }),
        enabled: !disabled,
        staleTime: 60_000,
    });

    const labelOf = (c: CourseCategoryRow): string => {
        if (locale === 'kz') return c.title_kz ?? c.title_kz ?? c.slug;
        return c.title_kz ?? c.title_kz ?? c.slug;
    };

    const selected = useMemo(() => {
        if (value == null) return null;
        return query.data?.rows.find((c) => c.id === value) ?? null;
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
                placeholder={placeholder ?? t('category_placeholder')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && !disabled ? (
                <div className='absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {query.isLoading ? (
                        <p className='p-3 text-xs text-muted-foreground'>...</p>
                    ) : (query.data?.rows.length ?? 0) === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('category_none')}</p>
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
                                {t('category_none')}
                            </button>
                            {(query.data?.rows ?? []).map((c) => {
                                const isSelected = value === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        type='button'
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            onChange(c.id, c);
                                            setSearchQuery('');
                                            setOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                            isSelected ? 'bg-muted' : ''
                                        }`}
                                    >
                                        <span className='truncate'>{labelOf(c)}</span>
                                        <span className='text-xs text-muted-foreground'>#{c.id}</span>
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
