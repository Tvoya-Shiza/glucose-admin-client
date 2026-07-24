'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listPublishers } from '@/lib/ebooks/api';

/** Sentinel for "no publisher" — Radix `<Select>` rejects empty-string values. */
const NONE = '__none__';

export interface PublisherSelectProps {
    value: number | null;
    onChange: (id: number | null) => void;
    /** Copy for the "no publisher / all publishers" row. */
    noneLabel?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

/**
 * Publisher picker backed by GET /publishers.
 *
 * Publishers are a tiny name-only reference table (tens of rows), so the whole
 * list is fetched once at the server cap (page_size=200) and cached for a minute
 * — no server-side search needed. Shared by the ebooks filter bar (where `null`
 * means "all") and the book metadata form (where `null` means "unset").
 */
export function PublisherSelect({ value, onChange, noneLabel, placeholder, disabled, className }: PublisherSelectProps) {
    const t = useTranslations('admin.ebooks');

    const { data, isLoading } = useQuery({
        queryKey: ['admin.publishers.list', { page_size: 200 }],
        queryFn: () => listPublishers({ page: 1, page_size: 200 }),
        enabled: !disabled,
        staleTime: 60_000,
    });

    const rows = data?.rows ?? [];

    return (
        <Select
            value={value == null ? NONE : String(value)}
            onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
            disabled={disabled}
        >
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder ?? t('filter_publisher')} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>{noneLabel ?? t('filter_all')}</SelectItem>
                {isLoading ? (
                    <SelectItem value='__loading__' disabled>
                        {t('loading')}
                    </SelectItem>
                ) : null}
                {rows.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
