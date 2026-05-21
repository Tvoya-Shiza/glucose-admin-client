'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnalyticsRange } from '@/lib/users/types';

export interface UsersRangePickerProps {
    range: AnalyticsRange;
    from?: number;
    to?: number;
    onChange: (next: { range: AnalyticsRange; from?: number; to?: number }) => void;
}

const PRESETS: AnalyticsRange[] = ['7d', '30d', '90d', '365d'];

/**
 * Preset + custom range picker for the users analytics section. Native
 * `<input type='date'>` is used for custom ranges — no react-day-picker dep.
 */
export function UsersRangePicker({ range, from, to, onChange }: UsersRangePickerProps) {
    const t = useTranslations('admin.users');

    return (
        <div className='flex flex-wrap items-end gap-2'>
            {PRESETS.map((p) => (
                <Button
                    key={p}
                    type='button'
                    size='sm'
                    variant={range === p ? 'default' : 'outline'}
                    onClick={() => onChange({ range: p, from: undefined, to: undefined })}
                    className={cn('tabular-nums')}
                >
                    {t(`range_${p}` as 'range_7d' | 'range_30d' | 'range_90d' | 'range_365d')}
                </Button>
            ))}
            <Button
                type='button'
                size='sm'
                variant={range === 'custom' ? 'default' : 'outline'}
                onClick={() => {
                    const now = Math.floor(Date.now() / 1000);
                    const initialFrom = from ?? now - 30 * 86_400;
                    const initialTo = to ?? now;
                    onChange({ range: 'custom', from: initialFrom, to: initialTo });
                }}
            >
                {t('range_custom')}
            </Button>
            {range === 'custom' ? (
                <>
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs font-medium text-muted-foreground'>{t('range_from')}</label>
                        <Input
                            type='date'
                            value={from ? unixToDateInput(from) : ''}
                            onChange={(e) =>
                                onChange({
                                    range: 'custom',
                                    from: dateInputToUnix(e.target.value, false),
                                    to,
                                })
                            }
                            className='w-40'
                        />
                    </div>
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs font-medium text-muted-foreground'>{t('range_to')}</label>
                        <Input
                            type='date'
                            value={to ? unixToDateInput(to) : ''}
                            onChange={(e) =>
                                onChange({
                                    range: 'custom',
                                    from,
                                    to: dateInputToUnix(e.target.value, true),
                                })
                            }
                            className='w-40'
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}

function unixToDateInput(unixSec: number): string {
    const d = new Date(unixSec * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dateInputToUnix(value: string, endOfDay: boolean): number | undefined {
    if (!value) return undefined;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return undefined;
    const ms = endOfDay
        ? Date.UTC(y, m - 1, d, 23, 59, 59)
        : Date.UTC(y, m - 1, d, 0, 0, 0);
    return Math.floor(ms / 1000);
}
