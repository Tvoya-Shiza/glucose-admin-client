'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { getGroup, listGroups } from '@/lib/groups/api';
import type { GroupRow } from '@/lib/groups/types';

export interface GroupPickerProps {
    value: number | null;
    onChange: (id: number | null, group: GroupRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Filter to status='active' only. Default `false` (show all). */
    activeOnly?: boolean;
    /** Fallback display label when value is set but row hasn't loaded yet. */
    initialLabel?: string | null;
}

/**
 * Phase 19 — searchable group picker. Mirrors CoursePicker/UserPicker patterns.
 *
 * Debounced text search → admin-api `GET /admin/groups?q=...`. When the input
 * is empty + a value is set, a single `getGroup(value)` resolves the label.
 */
export function GroupPicker({
    value,
    onChange,
    placeholder,
    disabled,
    activeOnly,
    initialLabel,
}: GroupPickerProps) {
    const t = useTranslations('admin.groups');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const list = useQuery({
        queryKey: ['admin.groups.list', { q: debouncedQuery, page_size: 10, status: activeOnly ? 'active' : null }],
        queryFn: () =>
            listGroups({
                q: debouncedQuery || undefined,
                page_size: 10,
                status: activeOnly ? 'active' : undefined,
            }),
        enabled: open && !disabled,
        staleTime: 30_000,
    });

    const selected = useQuery({
        queryKey: ['admin.groups.detail', value],
        queryFn: () => (value != null ? getGroup(value) : Promise.resolve(null)),
        enabled: value != null && !disabled,
        staleTime: 60_000,
    });

    const candidates: GroupRow[] = useMemo(() => list.data?.rows ?? [], [list.data]);

    const selectedLabel = useMemo(() => {
        if (value == null) return '';
        const fromList = candidates.find((g) => g.id === value);
        if (fromList?.name) return fromList.name;
        if (selected.data?.name) return selected.data.name;
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
                        <p className='p-3 text-xs text-muted-foreground'>{t('empty_admin')}</p>
                    ) : (
                        candidates.map((g) => {
                            const isSel = value === g.id;
                            return (
                                <button
                                    key={g.id}
                                    type='button'
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onChange(g.id, g);
                                        setSearchQuery('');
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                        isSel ? 'bg-muted' : ''
                                    }`}
                                >
                                    <span className='truncate'>{g.name}</span>
                                    <span className='text-xs text-muted-foreground'>
                                        {g.status} · #{g.id}
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
