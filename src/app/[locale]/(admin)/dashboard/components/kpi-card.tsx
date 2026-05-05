'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Phase 9 ANL-01 — KPI tile.
 *
 * Stateless presentational card used across the admin dashboard. Value already
 * formatted by the caller (e.g. Intl.NumberFormat for counts, custom formatter
 * for percent / currency) so this component stays locale-agnostic.
 */
export function KpiCard({
    label,
    value,
    hint,
}: {
    label: string;
    value: string | number;
    hint?: string;
}) {
    return (
        <Card>
            <CardHeader className='pb-2'>
                <CardTitle className='text-muted-foreground text-sm font-medium'>{label}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className='text-2xl font-semibold'>{value}</div>
                {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
            </CardContent>
        </Card>
    );
}
