'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { listCourses, getCourse } from '@/lib/courses/api';
import type { CourseRow, CourseStatus } from '@/lib/courses/types';

export interface CoursePickerProps {
    value: number | null;
    onChange: (id: number | null, course: CourseRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Restrict to a single status (e.g. 'active'). Omit for all-status. */
    status?: CourseStatus;
    /** Fallback display label when value is set but row hasn't loaded yet. */
    initialLabel?: string | null;
}

/**
 * Searchable course picker — Phase 18.
 *
 * Mirrors the UserPicker debounced-search pattern (300 ms; top-10 by query).
 * Title fallback order: title_kz → slug → "#id" (matches courses-list display).
 *
 * When `status='active'` is passed, the picker hides draft/pending/inactive
 * courses — the typical filter for "grant access" flows where granting access
 * to an unpublished course is rarely intentional.
 */
export function CoursePicker({
    value,
    onChange,
    placeholder,
    disabled,
    status,
    initialLabel,
}: CoursePickerProps) {
    const t = useTranslations('admin.courses');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const list = useQuery({
        queryKey: ['admin.courses.list', { q: debouncedQuery, page_size: 10, status: status ?? null }],
        queryFn: () =>
            listCourses({
                q: debouncedQuery || undefined,
                page_size: 10,
                status,
            }),
        enabled: open && !disabled,
        staleTime: 30_000,
    });

    const selected = useQuery({
        queryKey: ['admin.courses.detail', value],
        queryFn: () => (value != null ? getCourse(value) : Promise.resolve(null)),
        enabled: value != null && !disabled,
        staleTime: 60_000,
    });

    const candidates: CourseRow[] = useMemo(() => list.data?.rows ?? [], [list.data]);

    const selectedLabel = useMemo(() => {
        if (value == null) return '';
        const fromList = candidates.find((c) => c.id === value);
        if (fromList?.title_kz) return fromList.title_kz;
        if (fromList?.slug) return fromList.slug;
        const fromDetail = selected.data;
        if (fromDetail) {
            const ru = fromDetail.translations.find((tr) => tr.locale === 'kz')?.title;
            if (ru && ru.trim().length > 0) return ru;
            return fromDetail.slug;
        }
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
                placeholder={placeholder ?? t('search_placeholder')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && !disabled ? (
                <div className='absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {list.isFetching ? (
                        <p className='p-3 text-xs text-muted-foreground'>...</p>
                    ) : candidates.length === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('empty')}</p>
                    ) : (
                        candidates.map((c) => {
                            const isSel = value === c.id;
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
                                        isSel ? 'bg-muted' : ''
                                    }`}
                                >
                                    <span className='truncate'>{c.title_kz ?? c.slug}</span>
                                    <span className='text-xs text-muted-foreground'>
                                        {c.status} · #{c.id}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}
