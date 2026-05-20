'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SCHEDULE_KINDS, SCHEDULE_STATUSES, type ScheduleItemKind, type ScheduleStatus } from '@/lib/schedules/types';

export interface ScheduleFiltersValue {
    q?: string;
    status?: ScheduleStatus;
    curator_id?: number;
    group_id?: number;
    course_id?: number;
    kind?: ScheduleItemKind;
    from?: number;
    to?: number;
}

interface SchedulesFiltersProps {
    value: ScheduleFiltersValue;
    onChange: (next: ScheduleFiltersValue) => void;
    showWindowInputs?: boolean;
}

export function SchedulesFilters({ value, onChange, showWindowInputs = true }: SchedulesFiltersProps) {
    const t = useTranslations('admin.schedules');
    const [qLocal, setQLocal] = useState(value.q ?? '');

    const update = (patch: Partial<ScheduleFiltersValue>) => onChange({ ...value, ...patch });

    return (
        <div className='flex flex-wrap items-end gap-3'>
            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_q')}</label>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        update({ q: qLocal.trim().length > 0 ? qLocal.trim() : undefined });
                    }}
                >
                    <Input
                        value={qLocal}
                        onChange={(e) => setQLocal(e.target.value)}
                        placeholder={t('filter_q_placeholder')}
                        className='w-48'
                    />
                </form>
            </div>

            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_status')}</label>
                <Select
                    value={value.status ?? 'all'}
                    onValueChange={(v) => update({ status: v === 'all' ? undefined : (v as ScheduleStatus) })}
                >
                    <SelectTrigger className='w-40'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('status_all')}</SelectItem>
                        {SCHEDULE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                                {t(`status_${s}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_kind')}</label>
                <Select
                    value={value.kind ?? 'all'}
                    onValueChange={(v) => update({ kind: v === 'all' ? undefined : (v as ScheduleItemKind) })}
                >
                    <SelectTrigger className='w-40'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('kind_all')}</SelectItem>
                        {SCHEDULE_KINDS.map((k) => (
                            <SelectItem key={k} value={k}>
                                {t(`kind_${k}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_group')}</label>
                <Input
                    type='number'
                    min={1}
                    value={value.group_id ?? ''}
                    onChange={(e) =>
                        update({ group_id: e.target.value.length > 0 ? Number(e.target.value) : undefined })
                    }
                    placeholder='id'
                    className='w-24'
                />
            </div>

            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_curator')}</label>
                <Input
                    type='number'
                    min={1}
                    value={value.curator_id ?? ''}
                    onChange={(e) =>
                        update({ curator_id: e.target.value.length > 0 ? Number(e.target.value) : undefined })
                    }
                    placeholder='id'
                    className='w-24'
                />
            </div>

            <div className='flex flex-col gap-1'>
                <label className='text-xs font-medium text-muted-foreground'>{t('filter_course')}</label>
                <Input
                    type='number'
                    min={1}
                    value={value.course_id ?? ''}
                    onChange={(e) =>
                        update({ course_id: e.target.value.length > 0 ? Number(e.target.value) : undefined })
                    }
                    placeholder='id'
                    className='w-24'
                />
            </div>

            {showWindowInputs ? (
                <>
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs font-medium text-muted-foreground'>{t('filter_from')}</label>
                        <Input
                            type='date'
                            value={value.from ? unixToDateInput(value.from) : ''}
                            onChange={(e) => update({ from: dateInputToUnix(e.target.value, false) })}
                            className='w-40'
                        />
                    </div>
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs font-medium text-muted-foreground'>{t('filter_to')}</label>
                        <Input
                            type='date'
                            value={value.to ? unixToDateInput(value.to) : ''}
                            onChange={(e) => update({ to: dateInputToUnix(e.target.value, true) })}
                            className='w-40'
                        />
                    </div>
                </>
            ) : null}

            <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                    setQLocal('');
                    onChange({});
                }}
            >
                {t('filter_reset')}
            </Button>
        </div>
    );
}

function unixToDateInput(unixSec: number): string {
    const d = new Date(unixSec * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToUnix(value: string, endOfDay: boolean): number | undefined {
    if (!value) return undefined;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
    const [y, m, d] = parts as [number, number, number];
    const dt = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return Math.floor(dt.getTime() / 1000);
}
