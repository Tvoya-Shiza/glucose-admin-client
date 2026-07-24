'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/courses/api';
import type { CourseRow } from '@/lib/courses/types';

/**
 * One selected course chip. `title` is the display label captured at pick time so
 * the picker never has to re-fetch labels for already-selected ids (the trainer
 * detail seeds these from its `courses: { id, title_kz }[]`).
 */
export interface TrainerCourseChip {
    id: number;
    title: string | null;
}

export interface MultiCoursePickerProps {
    value: TrainerCourseChip[];
    onChange: (next: TrainerCourseChip[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Phase 38 — MULTI-select course (webinar) picker for a trainer's `course_ids`.
 *
 * Only a single-select CoursePicker exists in the codebase; this is the multi
 * variant the ТЗ calls for. It reuses the same `listCourses` debounced-search
 * query hook, appends the picked row to a chip list, filters out already-selected
 * courses from the dropdown, and renders removable Badge chips. The parent derives
 * `course_ids = value.map(c => c.id)` for the create/update payload.
 */
export function MultiCoursePicker({ value, onChange, placeholder, disabled }: MultiCoursePickerProps) {
    const t = useTranslations('admin.trainers');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const list = useQuery({
        queryKey: ['admin.courses.list', { q: debouncedQuery, page_size: 10, status: null }],
        queryFn: () => listCourses({ q: debouncedQuery || undefined, page_size: 10 }),
        enabled: open && !disabled,
        staleTime: 30_000,
    });

    const selectedIds = useMemo(() => new Set(value.map((c) => c.id)), [value]);

    const candidates: CourseRow[] = useMemo(() => (list.data?.rows ?? []).filter((c) => !selectedIds.has(c.id)), [list.data, selectedIds]);

    const add = (course: CourseRow) => {
        if (selectedIds.has(course.id)) return;
        onChange([...value, { id: course.id, title: course.title_kz ?? course.slug ?? null }]);
        setSearchQuery('');
        setOpen(false);
    };

    const remove = (id: number) => {
        onChange(value.filter((c) => c.id !== id));
    };

    return (
        <div className='space-y-2'>
            {value.length > 0 ? (
                <div className='flex flex-wrap gap-1.5'>
                    {value.map((c) => (
                        <Badge key={c.id} variant='secondary' className='gap-1 pr-1'>
                            <span className='truncate max-w-[16rem]'>{c.title ?? `#${c.id}`}</span>
                            {!disabled ? (
                                <button
                                    type='button'
                                    onClick={() => remove(c.id)}
                                    aria-label={t('course_remove')}
                                    className='rounded-full p-0.5 hover:bg-muted-foreground/20'
                                >
                                    <X className='h-3 w-3' />
                                </button>
                            ) : null}
                        </Badge>
                    ))}
                </div>
            ) : null}

            <div className='relative'>
                <Input
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!open) setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder ?? t('courses_search_placeholder')}
                    disabled={disabled}
                    autoComplete='off'
                />
                {open && !disabled ? (
                    <div className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                        {list.isFetching ? (
                            <p className='p-3 text-xs text-muted-foreground'>{t('loading')}</p>
                        ) : candidates.length === 0 ? (
                            <p className='p-3 text-xs text-muted-foreground'>{t('courses_no_results')}</p>
                        ) : (
                            candidates.map((c) => (
                                <button
                                    key={c.id}
                                    type='button'
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(c)}
                                    className='flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted'
                                >
                                    <span className='truncate'>{c.title_kz ?? c.slug}</span>
                                    <span className='text-xs text-muted-foreground'>
                                        {c.status} · #{c.id}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
