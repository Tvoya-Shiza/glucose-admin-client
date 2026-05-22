'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/lib/access/use-permission';
import { listCategories } from '@/lib/quizzes/api';
import type { QuizCategory } from '@/lib/quizzes/types';
import { UpsertCategoryDialog } from '@/app/[locale]/(admin)/quizzes/categories/components/upsert-category-dialog';

export interface QuizCategoryPickerProps {
    value: number | null;
    onChange: (id: number | null, category: QuizCategory | null) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Inline "+ Жаңа санат" row at top of dropdown (gated by `quizzes.create`). */
    allowInlineCreate?: boolean;
}

/**
 * Picker for QuizCategory rows — mirrors `CategoryPicker` for courses but talks
 * to the quizzes endpoints. The category list is small (< 200 rows typical) so
 * we fetch all of it and filter client-side by KZ title substring.
 */
export function QuizCategoryPicker({
    value,
    onChange,
    placeholder,
    disabled,
    allowInlineCreate = true,
}: QuizCategoryPickerProps) {
    const t = useTranslations('admin.quizzes');
    const canCreate = usePermission('quizzes.create');
    const showCreateRow = allowInlineCreate && canCreate;

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 250);
        return () => clearTimeout(id);
    }, [searchQuery]);

    const query = useQuery({
        queryKey: ['admin.quiz-categories.list'],
        queryFn: listCategories,
        enabled: !disabled,
        staleTime: 60_000,
    });

    const labelOf = (c: QuizCategory): string =>
        c.translations.find((tr) => tr.locale === 'kz')?.title ?? `#${c.id}`;

    const filtered = useMemo(() => {
        const rows = query.data ?? [];
        if (debouncedQuery === '') return rows;
        return rows.filter((c) => labelOf(c).toLowerCase().includes(debouncedQuery));
    }, [query.data, debouncedQuery]);

    const selected = useMemo(() => {
        if (value == null) return null;
        return (query.data ?? []).find((c) => c.id === value) ?? null;
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
                placeholder={placeholder ?? t('filter_category')}
                disabled={disabled}
                autoComplete='off'
            />
            {open && !disabled ? (
                <div className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border bg-popover text-popover-foreground shadow-md'>
                    {showCreateRow ? (
                        <button
                            type='button'
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                setOpen(false);
                                setCreateOpen(true);
                            }}
                            className='flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm text-primary hover:bg-muted'
                        >
                            <Plus className='size-3.5' />
                            {t('categories.add_root')}
                        </button>
                    ) : null}
                    {query.isLoading ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('loading')}</p>
                    ) : filtered.length === 0 ? (
                        <p className='p-3 text-xs text-muted-foreground'>{t('filter_all')}</p>
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
                            {filtered.map((c) => {
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

            {showCreateRow ? (
                <UpsertCategoryDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    initial={undefined}
                    parentIdForCreate={null}
                    onCreated={(row) => {
                        onChange(row.id, row);
                        setSearchQuery('');
                    }}
                />
            ) : null}
        </div>
    );
}
