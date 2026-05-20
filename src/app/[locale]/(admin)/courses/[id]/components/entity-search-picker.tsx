'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

export type EntityKind = 'quiz' | 'assignment' | 'lesson' | 'file' | 'curator' | 'user-group' | 'course';

interface EntitySearchOption {
    id: number;
    title: string;
}

interface QuizRow {
    id: number;
    title_kz: string | null;
}

interface AssignmentRow {
    id: number;
    title_kz: string | null;
    title_ru: string | null;
}

interface CourseRow {
    id: number;
    title_kz: string | null;
    title_ru: string | null;
}

interface ChapterRow {
    id: number;
    translations?: Array<{ locale: string; title: string }>;
    title_kz?: string | null;
    title_ru?: string | null;
}

interface FileRow {
    id: number;
    title_kz?: string | null;
    title_ru?: string | null;
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

    if (kind === 'quiz') {
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/quizzes?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<QuizRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.title_kz ?? `#${r.id}` }));
    }

    if (kind === 'assignment') {
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/assignments?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<AssignmentRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.title_kz ?? r.title_ru ?? `#${r.id}` }));
    }

    if (kind === 'course') {
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/courses?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<CourseRow>;
        return json.rows.map((r) => ({ id: r.id, title: r.title_kz ?? r.title_ru ?? `#${r.id}` }));
    }

    if (kind === 'lesson') {
        // "lesson" = WebinarChapter. Two paths: scoped to a course, or global search.
        if (typeof courseId === 'number' && courseId > 0) {
            const res = await fetchWithRefresh(`/api/proxy/v1/admin/courses/${courseId}/chapters`);
            if (!res.ok) throw new Error(`search failed: ${res.status}`);
            const json = (await res.json()) as ListResponse<ChapterRow>;
            const rows = json.rows.map((r) => ({
                id: r.id,
                title:
                    r.title_kz ??
                    r.title_ru ??
                    r.translations?.find((t) => t.locale === 'kz')?.title ??
                    r.translations?.find((t) => t.locale === 'ru')?.title ??
                    `#${r.id}`,
            }));
            if (needle.length === 0) return rows;
            const lower = needle.toLowerCase();
            return rows.filter((r) => r.title.toLowerCase().includes(lower));
        }
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/chapters?${params.toString()}`);
        if (!res.ok) {
            // Endpoint may not exist (global chapter search isn't implemented) — fall back to empty.
            return [];
        }
        const json = (await res.json()) as ListResponse<ChapterRow>;
        return json.rows.map((r) => ({
            id: r.id,
            title:
                r.title_kz ??
                r.title_ru ??
                r.translations?.find((t) => t.locale === 'kz')?.title ??
                r.translations?.find((t) => t.locale === 'ru')?.title ??
                `#${r.id}`,
        }));
    }

    if (kind === 'file') {
        params.set('status', 'active');
        const res = await fetchWithRefresh(`/api/proxy/v1/admin/files?${params.toString()}`);
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const json = (await res.json()) as ListResponse<FileRow>;
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

    useEffect(() => {
        const id = setTimeout(() => setDebounced(query), 250);
        return () => clearTimeout(id);
    }, [query]);

    const { data, isFetching } = useQuery({
        queryKey: ['admin.entity-search', kind, debounced, courseId ?? null],
        queryFn: () => searchEntities(kind, debounced, courseId),
        enabled: open,
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
        <div className='space-y-1.5'>
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
