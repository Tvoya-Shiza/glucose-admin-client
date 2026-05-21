'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { AnalyticsBucket } from '@/lib/users/types';

interface Props {
    data: Array<{ bucket: number; count: number }>;
    bucket: AnalyticsBucket;
    locale: string;
    label: string;
}

/**
 * Daily/weekly/monthly registrations bar chart. Bucket Unix seconds → locale-aware
 * tick label depending on the bucket size.
 */
export function UsersRegistrationsChart({ data, bucket, locale, label }: Props) {
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : locale;
    const chartData = data.map((p) => ({
        ts: p.bucket,
        label: formatTick(p.bucket, bucket, intlLocale),
        count: p.count,
    }));

    return (
        <ChartContainer config={{ count: { label, color: 'hsl(var(--primary))' } }} className='h-72 w-full'>
            <BarChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis dataKey='label' tickLine={false} axisLine={false} interval='preserveStartEnd' />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey='count' fill='var(--color-count)' radius={4} />
            </BarChart>
        </ChartContainer>
    );
}

function formatTick(unixSec: number, bucket: AnalyticsBucket, intlLocale: string): string {
    const d = new Date(unixSec * 1000);
    if (bucket === 'month') {
        return new Intl.DateTimeFormat(intlLocale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(d);
    }
    if (bucket === 'week') {
        return new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(d);
    }
    return new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(d);
}
