'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntitySearchPicker } from '@/app/[locale]/(admin)/courses/[id]/components/entity-search-picker';
import { SCHEDULE_KINDS, type ScheduleItemInput, type ScheduleItemKind } from '@/lib/schedules/types';

interface ScheduleItemDraft extends ScheduleItemInput {
    _key: string;
    _title?: string;
}

interface ScheduleItemsEditorProps {
    value: ScheduleItemDraft[];
    onChange: (next: ScheduleItemDraft[]) => void;
    courseId?: number | null;
}

export function ScheduleItemsEditor({ value, onChange, courseId }: ScheduleItemsEditorProps) {
    const t = useTranslations('admin.schedules');
    const [adding, setAdding] = useState<{ kind: ScheduleItemKind | null }>({ kind: null });

    const addRow = (kind: ScheduleItemKind) => setAdding({ kind });

    const commitItem = (item: { id: number; title?: string }) => {
        if (!adding.kind) return;
        const next: ScheduleItemDraft = {
            _key: `${adding.kind}-${item.id}-${Date.now()}`,
            kind: adding.kind,
            ref_id: item.id,
            position: value.length,
            _title: item.title,
        };
        onChange([...value, next]);
        setAdding({ kind: null });
    };

    const removeAt = (idx: number) => {
        const next = value.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i }));
        onChange(next);
    };

    const move = (idx: number, dir: -1 | 1) => {
        const target = idx + dir;
        if (target < 0 || target >= value.length) return;
        const a = value[idx];
        const b = value[target];
        if (!a || !b) return;
        const next = [...value];
        next[idx] = b;
        next[target] = a;
        onChange(next.map((it, i) => ({ ...it, position: i })));
    };

    return (
        <div className='space-y-2'>
            <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>
                    {t('items_label')} <span className='text-muted-foreground'>({value.length})</span>
                </span>
                {adding.kind === null ? (
                    <div className='flex items-center gap-2'>
                        <Select value='' onValueChange={(v) => addRow(v as ScheduleItemKind)}>
                            <SelectTrigger className='h-8 w-36'>
                                <SelectValue placeholder={t('items_add')} />
                            </SelectTrigger>
                            <SelectContent>
                                {SCHEDULE_KINDS.map((k) => (
                                    <SelectItem key={k} value={k}>
                                        {t(`kind_${k}`)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <Button type='button' variant='ghost' size='sm' onClick={() => setAdding({ kind: null })}>
                        <X className='h-3.5 w-3.5' />
                    </Button>
                )}
            </div>

            {adding.kind ? (
                <div className='rounded border border-dashed bg-muted/40 p-2'>
                    <div className='mb-1.5 flex items-center gap-2 text-xs text-muted-foreground'>
                        <Plus className='h-3 w-3' />
                        {t(`kind_${adding.kind}`)}
                    </div>
                    <EntitySearchPicker
                        kind={adding.kind}
                        value=''
                        onChange={(idStr, opt) => {
                            if (idStr) commitItem({ id: Number(idStr), title: opt?.title });
                        }}
                        courseId={courseId}
                    />
                </div>
            ) : null}

            {value.length === 0 && adding.kind === null ? (
                <p className='rounded border border-dashed p-3 text-center text-xs text-muted-foreground'>
                    {t('items_empty')}
                </p>
            ) : (
                <ul className='space-y-1'>
                    {value.map((it, idx) => (
                        <li
                            key={it._key}
                            className='flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-sm'
                        >
                            <button
                                type='button'
                                className='cursor-grab text-muted-foreground'
                                onClick={() => move(idx, -1)}
                                title={t('move_up')}
                            >
                                <GripVertical className='h-4 w-4' />
                            </button>
                            <span className='inline-block min-w-[80px] rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase'>
                                {t(`kind_${it.kind}_short`)}
                            </span>
                            <span className='flex-1 truncate'>
                                {it._title ?? `#${it.ref_id}`}
                                <span className='ml-1 text-xs text-muted-foreground'>id: {it.ref_id}</span>
                            </span>
                            <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={() => removeAt(idx)}>
                                <X className='h-3.5 w-3.5' />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export type { ScheduleItemDraft };
