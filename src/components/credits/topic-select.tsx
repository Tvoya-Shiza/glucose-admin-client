'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCreditTopics } from '@/lib/credits/api';
import { buildCreditTopicTree, flattenCreditTopicTree } from '@/lib/credits/topic-tree';

const ALL_SENTINEL = '__all__';

export interface CreditTopicSelectProps {
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder?: string;
    /** Renders an extra "all" item mapping to null (filter usage). */
    emptyLabel?: string;
    includeArchived?: boolean;
    disabled?: boolean;
    className?: string;
}

/**
 * Flat topic select rendering the tree with NBSP indentation per depth —
 * the "flat tree" pattern for filters + the question upsert dialog.
 */
export function CreditTopicSelect({
    value,
    onChange,
    placeholder,
    emptyLabel,
    includeArchived = false,
    disabled,
    className,
}: CreditTopicSelectProps) {
    const { data: topics = [] } = useQuery({
        queryKey: ['admin.credits.topics', { include_archived: includeArchived }],
        queryFn: () => listCreditTopics(includeArchived),
        staleTime: 30_000,
        enabled: !disabled,
    });

    const flat = useMemo(() => flattenCreditTopicTree(buildCreditTopicTree(topics)), [topics]);

    return (
        <Select
            value={value ?? (emptyLabel ? ALL_SENTINEL : '')}
            onValueChange={(v) => onChange(v === ALL_SENTINEL ? null : v)}
            disabled={disabled}
        >
            <SelectTrigger className={className}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {emptyLabel ? <SelectItem value={ALL_SENTINEL}>{emptyLabel}</SelectItem> : null}
                {flat.map(({ node, depth }) => (
                    <SelectItem key={node.id} value={node.id}>
                        {' '.repeat(depth * 3)}
                        {node.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
