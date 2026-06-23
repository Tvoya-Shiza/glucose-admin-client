'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { listGroups } from '@/lib/groups/api';

/**
 * GroupWhitelistField — Phase 33.
 *
 * Edits the group access whitelist for a lesson or module. Empty list = visible
 * to all groups; a non-empty list restricts visibility to the selected groups
 * (everyone else has the lesson/module hidden in the student app).
 *
 * Mirrors GroupContextPicker's data source (listGroups, page_size 200). The
 * parent owns the value (number[] of group ids) and passes `disabled` from
 * usePermission('courses.edit').
 */
export function GroupWhitelistField({
    value,
    onChange,
    disabled,
}: {
    value: number[];
    onChange: (next: number[]) => void;
    disabled?: boolean;
}) {
    const t = useTranslations('admin.courses');

    const { data, isLoading } = useQuery({
        queryKey: ['admin.groups.list', { page: 1, page_size: 200 }],
        queryFn: () => listGroups({ page: 1, page_size: 200 }),
        staleTime: 60_000,
    });

    const rows = data?.rows ?? [];
    const nameById = new Map(rows.map((g) => [g.id, g.name]));
    const available = rows.filter((g) => !value.includes(g.id));

    const add = (id: number) => {
        if (!value.includes(id)) onChange([...value, id]);
    };
    const remove = (id: number) => onChange(value.filter((g) => g !== id));

    return (
        <div className='space-y-2'>
            <Label className='text-sm font-medium'>{t('group_access_label')}</Label>
            <p className='text-xs text-muted-foreground'>{t('group_access_hint')}</p>

            {value.length === 0 ? (
                <p className='text-xs text-muted-foreground italic'>{t('group_access_all')}</p>
            ) : (
                <div className='flex flex-wrap gap-1.5'>
                    {value.map((id) => (
                        <Badge key={id} variant='secondary' className='gap-1'>
                            {nameById.get(id) ?? `#${id}`}
                            {!disabled ? (
                                <button
                                    type='button'
                                    onClick={() => remove(id)}
                                    className='ml-0.5 rounded-sm hover:text-destructive'
                                    aria-label='remove'
                                >
                                    <X className='size-3' />
                                </button>
                            ) : null}
                        </Badge>
                    ))}
                </div>
            )}

            {!disabled ? (
                <Select
                    value=''
                    onValueChange={(v) => {
                        const id = Number(v);
                        if (Number.isFinite(id) && id > 0) add(id);
                    }}
                    disabled={isLoading || available.length === 0}
                >
                    <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('group_access_add')} />
                    </SelectTrigger>
                    <SelectContent>
                        {available.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                                {g.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    );
}
