'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { listBlogCategories } from '@/lib/blogs/api';
import type { BlogStatus } from '@/lib/blogs/types';

export interface BlogsFiltersValue {
    q?: string;
    status?: BlogStatus;
    category_id?: number;
}

export interface BlogsFiltersProps {
    value: BlogsFiltersValue;
    onChange: (next: BlogsFiltersValue) => void;
}

const ALL = '__all__';

/**
 * BLG-01 — top filter bar (search + status + category select).
 *
 * Search debounces 300ms locally (D-03). Category list pulls from BFF via TanStack
 * Query so the dropdown stays in sync with category mutations on the categories
 * sub-page (cache key 'admin.blogs.categories').
 */
export function BlogsFilters({ value, onChange }: BlogsFiltersProps) {
    const t = useTranslations('admin.blogs');
    const [qLocal, setQLocal] = useState(value.q ?? '');

    const cats = useQuery({
        queryKey: ['admin.blogs.categories'],
        queryFn: () => listBlogCategories(),
        staleTime: 60_000,
    });

    useEffect(() => {
        const id = setTimeout(() => {
            if ((value.q ?? '') !== qLocal) {
                onChange({ ...value, q: qLocal || undefined });
            }
        }, 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qLocal]);

    return (
        <div className='flex flex-wrap items-center gap-3 border-b p-4'>
            <Input
                className='max-w-sm'
                placeholder={t('search_placeholder')}
                value={qLocal}
                onChange={(e) => setQLocal(e.target.value)}
            />
            <Select
                value={value.status ?? ALL}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        status: v === ALL ? undefined : (v as BlogStatus),
                    })
                }
            >
                <SelectTrigger className='w-44'>
                    <SelectValue placeholder={t('filter_status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                    <SelectItem value='publish'>{t('status_publish')}</SelectItem>
                </SelectContent>
            </Select>
            <Select
                value={value.category_id ? String(value.category_id) : ALL}
                onValueChange={(v) =>
                    onChange({
                        ...value,
                        category_id: v === ALL ? undefined : Number(v),
                    })
                }
            >
                <SelectTrigger className='w-56'>
                    <SelectValue placeholder={t('filter_category')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{t('filter_all')}</SelectItem>
                    {(cats.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                            {c.title_kz ?? `#${c.id}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
