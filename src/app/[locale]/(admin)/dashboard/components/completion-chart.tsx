'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { CompletionRatePoint } from '@/lib/analytics/types';

/**
 * Phase 9 ANL-04 (D-13, D-16) — 30-day completion-rate line chart.
 *
 * `completion_rate` is a 0..1 float on the wire (from admin-kpi service); we
 * convert to percent (1 decimal place) for display. Y-axis pinned to [0, 100]
 * so an empty stretch of days doesn't auto-zoom in misleadingly.
 */
interface Props {
    data: CompletionRatePoint[];
    titleY: string;
}

export function CompletionChart({ data, titleY }: Props) {
    const chartData = data.map((p) => ({
        date: p.date,
        percent: Math.round(p.completion_rate * 1000) / 10,
    }));
    return (
        <ChartContainer
            config={{ percent: { label: titleY, color: 'hsl(var(--primary))' } }}
            className='h-72 w-full'
        >
            <LineChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis dataKey='date' tickLine={false} axisLine={false} />
                <YAxis
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey='percent' stroke='var(--color-percent)' strokeWidth={2} dot={false} />
            </LineChart>
        </ChartContainer>
    );
}
