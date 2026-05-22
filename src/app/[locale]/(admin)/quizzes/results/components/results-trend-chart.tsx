'use client';

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { DailyTrendPoint } from '@/lib/quizzes/types';

interface Props {
    data: DailyTrendPoint[];
    locale: string;
    labels: { passed: string; failed: string; waiting: string };
}

/**
 * Stacked bar chart of daily attempts by status. Mirrors the dashboard
 * `RevenueChart` chart container posture (ChartContainer / ChartTooltip).
 */
export function ResultsTrendChart({ data, locale, labels }: Props) {
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const fmtDate = (s: string) => {
        try {
            const d = new Date(`${s}T00:00:00Z`);
            return new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' }).format(d);
        } catch {
            return s;
        }
    };

    return (
        <ChartContainer
            config={{
                passed: { label: labels.passed, color: 'hsl(142 71% 45%)' },
                failed: { label: labels.failed, color: 'hsl(0 84% 60%)' },
                waiting: { label: labels.waiting, color: 'hsl(38 92% 50%)' },
            }}
            className='h-72 w-full'
        >
            <BarChart data={data}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis dataKey='date' tickFormatter={fmtDate} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey='passed' stackId='a' fill='var(--color-passed)' radius={[0, 0, 0, 0]} />
                <Bar dataKey='failed' stackId='a' fill='var(--color-failed)' radius={[0, 0, 0, 0]} />
                <Bar dataKey='waiting' stackId='a' fill='var(--color-waiting)' radius={[4, 4, 0, 0]} />
            </BarChart>
        </ChartContainer>
    );
}
