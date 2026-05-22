'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { listUsers, getUser } from '@/lib/users/api';
import type { StaffRoleName, UserRow } from '@/lib/users/types';

export interface UserPickerProps {
    /** Roles to search across — multiple roles run as parallel listUsers queries.
     *  Pass an empty array to search ALL users regardless of role (one unfiltered
     *  listUsers call). Useful when operators need to find anyone by name/email
     *  without knowing their role label upfront. */
    roles: Array<StaffRoleName | 'student'>;
    value: number | null;
    onChange: (id: number | null, user: UserRow | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Hide the listbox until the user types this many characters. Default 1.
     *  Set to 0 to show top candidates on focus (helpful when the search source
     *  is bounded — e.g. one role). */
    minQueryLength?: number;
    /** Optional fallback display label when value is set but row hasn't loaded yet. */
    initialLabel?: string | null;
}

/**
 * Reusable searchable picker for users filtered by one or more roles.
 *
 * Mirrors the debounced-search pattern from
 * src/app/[locale]/(admin)/blogs/components/author-change-dialog.tsx (parallel
 * useQuery per role, merge + dedup by id, top-10 results). Decoupled so the
 * create-course dialog and any future dialogs can drop it in.
 *
 * Behavior:
 *   - The text input shows the search query OR the selected user's display label.
 *   - When the input is empty + a value is set, we fetch the user once via
 *     `getUser(value)` so the label doesn't show "#42".
 *   - Selecting a row collapses the listbox; the operator can clear by deleting
 *     the input text and clicking outside.
 */
export function UserPicker({
    roles,
    value,
    onChange,
    placeholder,
    disabled,
    minQueryLength = 1,
    initialLabel,
}: UserPickerProps) {
    const tCommon = useTranslations('admin.users');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [searchQuery]);

    // When `roles` is empty we fall through to a single unfiltered query — covers
    // the "search anyone by name/email" UX without forcing the caller to enumerate
    // every role label. Otherwise parallel queries per role with cache reuse.
    const queryDefs = useMemo(
        () =>
            roles.length === 0
                ? [
                      {
                          queryKey: ['admin.users.list', { role_name: null, q: debouncedQuery, page_size: 10 }] as const,
                          queryFn: () => listUsers({ q: debouncedQuery || undefined, page_size: 10 }),
                          enabled: open && debouncedQuery.length >= minQueryLength && !disabled,
                          staleTime: 30_000,
                      },
                  ]
                : roles.map((role) => ({
                      queryKey: ['admin.users.list', { role_name: role, q: debouncedQuery, page_size: 10 }] as const,
                      queryFn: () => listUsers({ role_name: role, q: debouncedQuery || undefined, page_size: 10 }),
                      enabled: open && debouncedQuery.length >= minQueryLength && !disabled,
                      staleTime: 30_000,
                  })),
        [roles, debouncedQuery, open, minQueryLength, disabled],
    );
    const queries = useQueries({ queries: queryDefs });

    // Single fetch to resolve the selected value's display label when no search text.
    const selectedQuery = useQuery({
        queryKey: ['admin.users.detail', value],
        queryFn: () => (value != null ? getUser(value) : Promise.resolve(null)),
        enabled: value != null && !disabled,
        staleTime: 60_000,
    });

    const candidates: UserRow[] = useMemo(() => {
        const seen = new Set<number>();
        const out: UserRow[] = [];
        for (const q of queries) {
            for (const u of q.data?.rows ?? []) {
                if (!seen.has(u.id)) {
                    seen.add(u.id);
                    out.push(u);
                }
            }
        }
        return out.slice(0, 10);
    }, [queries]);

    const isSearching = queries.some((q) => q.isFetching);

    const selectedLabel = useMemo(() => {
        if (value == null) return '';
        const fromList = candidates.find((u) => u.id === value);
        if (fromList?.full_name) return fromList.full_name;
        if (fromList?.email) return fromList.email;
        const fromDetail = selectedQuery.data;
        if (fromDetail?.full_name) return fromDetail.full_name;
        if (fromDetail?.email) return fromDetail.email;
        if (initialLabel) return initialLabel;
        return `#${value}`;
    }, [candidates, selectedQuery.data, value, initialLabel]);

    // The visible value: either the active search text or the resolved selected label.
    const displayValue = open ? searchQuery : value != null ? selectedLabel : '';

    return (
        <div className='relative'>
            <Input
                value={displayValue}
                onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!open) setOpen(true);
                    // Clear selection if user wipes input while typing.
                    if (e.target.value === '' && value != null) {
                        onChange(null, null);
                    }
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    // Defer close so list-item clicks fire first.
                    setTimeout(() => setOpen(false), 150);
                }}
                placeholder={placeholder ?? tCommon('search_placeholder')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && debouncedQuery.length >= minQueryLength && !disabled ? (
                <div className='absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {isSearching ? (
                        <p className='p-3 text-xs text-muted-foreground'>...</p>
                    ) : candidates.length === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{tCommon('empty')}</p>
                    ) : (
                        candidates.map((u) => {
                            const selected = value === u.id;
                            return (
                                <button
                                    key={u.id}
                                    type='button'
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        onChange(u.id, u);
                                        setSearchQuery('');
                                        setOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                        selected ? 'bg-muted' : ''
                                    }`}
                                >
                                    <span className='truncate'>{u.full_name ?? u.email ?? `#${u.id}`}</span>
                                    <span className='text-xs text-muted-foreground'>
                                        {String(u.role_name)} · #{u.id}
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
