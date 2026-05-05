'use client';

import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { AnalyticsQuery } from '@/lib/analytics/types';

/**
 * Phase 9 ANL-02 (D-11, D-17) — curator-window picker bound to nuqs URL state.
 *
 * URL key: ?window=1d|7d|30d|all (default 7d). Sharing the URL preserves the
 * picker, per D-17 ("filters bind to URL state").
 */
export const WINDOWS = ['1d', '7d', '30d', 'all'] as const;
export type WindowValue = (typeof WINDOWS)[number];

export function WindowPicker() {
    const t = useTranslations('admin.dashboard');
    const [w, setW] = useQueryState('window', parseAsStringLiteral(WINDOWS).withDefault('7d'));
    return (
        <ToggleGroup
            type='single'
            value={w}
            onValueChange={(v) => v && setW(v as WindowValue)}
            variant='outline'
            size='sm'
        >
            <ToggleGroupItem value='1d'>{t('curator_window_1d')}</ToggleGroupItem>
            <ToggleGroupItem value='7d'>{t('curator_window_7d')}</ToggleGroupItem>
            <ToggleGroupItem value='30d'>{t('curator_window_30d')}</ToggleGroupItem>
            <ToggleGroupItem value='all'>{t('curator_window_all')}</ToggleGroupItem>
        </ToggleGroup>
    );
}

/**
 * Map UI window string → analytics query params accepted by Plan 04 services.
 *
 * - 'all'  → window_all=true (server interprets as Unix epoch start).
 * - '1d'   → window_days=1
 * - '7d'   → window_days=7 (default)
 * - '30d'  → window_days=30
 */
export function windowToQueryParams(w: WindowValue): Pick<AnalyticsQuery, 'window_days' | 'window_all'> {
    if (w === 'all') return { window_all: true };
    if (w === '1d') return { window_days: 1 };
    if (w === '30d') return { window_days: 30 };
    return { window_days: 7 };
}
