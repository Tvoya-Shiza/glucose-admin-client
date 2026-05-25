'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { fetchCoursePickerItems, type PickerItemKind } from '@/lib/courses/picker-items';

export type EntityKind = 'quiz' | 'assignment' | 'lesson' | 'file' | 'curator' | 'user-group' | 'course';

const COURSE_SCOPED_KINDS: readonly EntityKind[] = ['lesson', 'quiz', 'assignment', 'file'];

interface EntitySearchOption {
    id: number;
    title: string;
}

interface CourseRow {
    id: number;
    title_kz: string | null;
    title_ru: string | null;
}

interface UserRow {
    id: number;
    full_name: string | null;
    email: string | null;
}

interface GroupRow {
    id: number;
    name: string;
}

interface ListResponse<T> {
    rows: T[];
}

async function searchEntities(kind: EntityKind, q: string, courseId?: number | null): Promise<EntitySearchOption[]> {
    const params = new URLSearchParams({ page_size: '20' });
    const needle = q.trim();
    if (needle.length > 0) params.set('q', needle);

    // lesson / quiz / assignment / file — all course-scoped: one shared
    // /admin/courses/:id/picker-items endpoint, discriminated by kind.
    if (COURSE_SCOPED_KINDS.includes(kind)) {
        if (typeof courseId !== 'number' || courseId <= 0) {
            // Picker should never be rendered without a course (the upsert dialog
            // gates the items editor), but stay defensive — return empty rather
            // than throw, so a misuse doesn't crash the form.
            return [];
        }
        const json = await fetchCoursePickerItems(courseId, kind as PickerItemKind, needle);
        return json.rows.map((r) => ({
            id: r.id,
            title: r.title_kz ?? r.title_ru ?? `#${r.id}`,
        }));
    }

    if (kind === 'course') {
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/courses?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<CourseRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.title_kz ?? r.title_ru ?? `#${r.id}` }));
    }

    if (kind === 'curator') {
        // admin-api ListUsersDto whitelist accepts `role_name`, not `role`. Wildcard
        // intentional: the picker is used to assign curators OR teachers to a
        // schedule, so we don't pre-filter — caller can narrow if needed.
        params.set('role_name', 'curator');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/users?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<UserRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.full_name ?? r.email ?? `#${r.id}` }));
    }

    if (kind === 'user-group') {
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/groups?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<GroupRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.name }));
    }

    return [];
}

interface EntitySearchPickerProps {
    kind: EntityKind;
    value: string;
    onChange: (id: string, option?: EntitySearchOption) => void;
    placeholder?: string;
    courseId?: number | null;
}

export function EntitySearchPicker({ kind, value, onChange, placeholder, courseId }: EntitySearchPickerProps) {
    const t = useTranslations('admin.courses');
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(query), 250);
        return () => clearTimeout(id);
    }, [query]);

    // Close dropdown when clicking outside the component.
    useEffect(() => {
        if (!open) return;
        const onMouseDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [open]);

    const isCourseScoped = COURSE_SCOPED_KINDS.includes(kind);
    const queryEnabled = open && (!isCourseScoped || typeof courseId === 'number');

    const { data, isFetching } = useQuery({
        queryKey: ['admin.entity-search', kind, debounced, courseId ?? null],
        queryFn: () => searchEntities(kind, debounced, courseId),
        enabled: queryEnabled,
        staleTime: 30_000,
        placeholderData: (prev) => prev,
    });

    const selectedId = value.trim().length > 0 ? Number(value) : null;
    const options = useMemo(() => data ?? [], [data]);
    const selected = useMemo(() => options.find((o) => o.id === selectedId) ?? null, [options, selectedId]);

    const fallbackPlaceholder =
        kind === 'quiz'
            ? t('item_quiz_id_placeholder')
            : kind === 'assignment'
              ? t('item_assignment_id_placeholder')
              : `Search ${kind}…`;

    return (
        <div ref={containerRef} className='space-y-1.5'>
            {selectedId != null ? (
                <div className='flex items-center justify-between rounded border px-3 py-2'>
                    <div className='flex items-center gap-2'>
                        <Check className='h-4 w-4 text-emerald-600' />
                        <span className='font-medium'>{selected?.title ?? `#${selectedId}`}</span>
                        <span className='text-xs text-muted-foreground'>id: {selectedId}</span>
                    </div>
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                            onChange('');
                            setQuery('');
                            setOpen(true);
                        }}
                    >
                        <X className='h-4 w-4' />
                    </Button>
                </div>
            ) : (
                <div className='relative'>
                    <div className='relative'>
                        <Search className='pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                        <Input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setOpen(true);
                            }}
                            onFocus={() => setOpen(true)}
                            placeholder={placeholder ?? fallbackPlaceholder}
                            className='pl-8'
                        />
                    </div>
                    {open ? (
                        <div className='absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded border bg-popover shadow-md'>
                            {isFetching && options.length === 0 ? (
                                <div className='space-y-1 p-2'>
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <Skeleton key={i} className='h-7 w-full' />
                                    ))}
                                </div>
                            ) : options.length === 0 ? (
                                <div className='p-3 text-sm text-muted-foreground'>—</div>
                            ) : (
                                <ul>
                                    {options.map((o) => (
                                        <li key={o.id}>
                                            <button
                                                type='button'
                                                className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent'
                                                onClick={() => {
                                                    onChange(String(o.id), o);
                                                    setOpen(false);
                                                    setQuery('');
                                                }}
                                            >
                                                <span className='truncate'>{o.title}</span>
                                                <span className='text-xs text-muted-foreground'>#{o.id}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
