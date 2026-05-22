'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TopGroupRow } from '@/lib/quizzes/types';

interface Props {
    rows: TopGroupRow[];
}

export function TopGroupsTable({ rows }: Props) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();
    const intlLocale = locale === 'kz' ? 'kk-KZ' : locale;
    const fmt = new Intl.NumberFormat(intlLocale);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('results_stats_top_groups_title')}</CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>{t('no_results_yet')}</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-10'>{t('results_stats_top_col_rank')}</TableHead>
                                <TableHead>{t('results_stats_top_col_group')}</TableHead>
                                <TableHead className='text-right'>{t('results_stats_top_col_attempts')}</TableHead>
                                <TableHead className='text-right'>{t('results_stats_top_col_pass_rate')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r, i) => (
                                <TableRow key={r.group_id}>
                                    <TableCell className='text-muted-foreground tabular-nums text-sm'>{i + 1}</TableCell>
                                    <TableCell>
                                        <Link href={`/${locale}/groups/${r.group_id}`} className='hover:underline'>
                                            {r.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className='text-right tabular-nums text-sm'>
                                        {fmt.format(r.attempt_count)}
                                    </TableCell>
                                    <TableCell className='text-right tabular-nums text-sm'>
                                        {(r.pass_rate * 100).toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
