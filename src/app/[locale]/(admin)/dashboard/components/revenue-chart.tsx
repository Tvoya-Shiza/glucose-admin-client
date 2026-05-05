'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { MonthlyRevenuePoint } from '@/lib/analytics/types';

/**
 * Phase 9 ANL-04 (D-13, D-15) — 12-month revenue bar chart.
 *
 * Decimal-as-string converted to Number for chart axis only — wire stays string
 * (BigInt-as-string posture per admin-client CLAUDE.md). KZT volumes
 * (millions/billions) are well within MAX_SAFE_INTEGER, so the conversion is
 * precision-safe. Documented in T-09-05-03.
 */
interface Props {
    data: MonthlyRevenuePoint[];
    locale: string;
    titleY: string;
}

export function RevenueChart({ data, locale, titleY }: Props) {
    // Remap locale 'kz' (our URL convention) → 'kk-KZ' (BCP-47) for Intl APIs.
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const chartData = data.map((p) => ({ month: p.month, revenue: Number(p.revenue) }));
    return (
        <ChartContainer
            config={{ revenue: { label: titleY, color: 'hsl(var(--primary))' } }}
            className='h-72 w-full'
        >
            <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis dataKey='month' tickLine={false} axisLine={false} />
                <YAxis
                    tickFormatter={(v: number) => new Intl.NumberFormat(intlLocale).format(v)}
                    tickLine={false}
                    axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey='revenue' fill='var(--color-revenue)' radius={4} />
            </BarChart>
        </ChartContainer>
    );
}
