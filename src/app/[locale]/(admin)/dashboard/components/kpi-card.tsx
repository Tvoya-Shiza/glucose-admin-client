'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phase 9 ANL-01 — KPI tile.
 *
 * Stateless presentational card. Value is pre-formatted by the caller.
 */
export function KpiCard({
    label,
    value,
    hint,
    icon: Icon,
    trend,
}: {
    label: string;
    value: string | number;
    hint?: string;
    icon?: LucideIcon;
    trend?: 'up' | 'down' | 'flat';
}) {
    return (
        <Card className='relative overflow-hidden border-border/70 transition-shadow hover:shadow-sm'>
            <span aria-hidden className='absolute inset-x-0 top-0 h-0.5 bg-primary/70' />
            <CardHeader className='flex flex-row items-center justify-between gap-2 pb-2'>
                <CardTitle className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                    {label}
                </CardTitle>
                {Icon && (
                    <span className='flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-primary'>
                        <Icon size={16} />
                    </span>
                )}
            </CardHeader>
            <CardContent className='space-y-1'>
                <div className='text-3xl font-bold tracking-tight tabular-nums text-foreground'>{value}</div>
                {hint && (
                    <p
                        className={cn(
                            'text-xs',
                            trend === 'up' && 'text-brand-700',
                            trend === 'down' && 'text-destructive',
                            !trend && 'text-muted-foreground',
                        )}
                    >
                        {hint}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
