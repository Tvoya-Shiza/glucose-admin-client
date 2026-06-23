'use client';

import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatScheduleRange, htmlToPlainText } from '@/lib/schedules/format';
import type { Schedule, ScheduleItem, ScheduleStatus } from '@/lib/schedules/types';

export interface SchedulesTableProps {
    rows: Schedule[];
    loading?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    onEdit?: (row: Schedule) => void;
    onDelete?: (row: Schedule) => void;
}

const STATUS_VARIANT: Record<ScheduleStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    draft: 'outline',
    scheduled: 'default',
    in_progress: 'secondary',
    completed: 'secondary',
    cancelled: 'destructive',
};

export function SchedulesTable({ rows, loading, canEdit, canDelete, onEdit, onDelete }: SchedulesTableProps) {
    const t = useTranslations('admin.schedules');
    const locale = useLocale();

    if (loading && rows.length === 0) {
        return (
            <div className='space-y-2 p-4'>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                ))}
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_when')}</TableHead>
                    <TableHead>{t('col_curator')}</TableHead>
                    <TableHead>{t('col_group')}</TableHead>
                    <TableHead>{t('col_course')}</TableHead>
                    <TableHead>{t('col_items')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead className='text-right'>{t('col_actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell className='font-medium tabular-nums'>
                            {formatScheduleRange(row.start_at, row.end_at, locale)}
                            {row.description ? (
                                <div className='mt-0.5 line-clamp-1 text-xs text-muted-foreground'>
                                    {htmlToPlainText(row.description)}
                                </div>
                            ) : null}
                        </TableCell>
                        <TableCell>{row.curator_name ?? `#${row.curator_id}`}</TableCell>
                        <TableCell>
                            {row.group_name ?? <Badge variant='outline'>{t('group_general')}</Badge>}
                            {(row.block_before_start || row.block_after_end) && (
                                <Badge variant='secondary' className='ml-1 text-xs' title={t('blocks_access')}>
                                    {t('blocks_access')}
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground'>
                            {row.course_id
                                ? (locale === 'kz' ? row.course_title_kz : row.course_title_ru) ?? `#${row.course_id}`
                                : '—'}
                        </TableCell>
                        <TableCell>
                            <div className='flex flex-wrap gap-1'>
                                {row.items.length === 0 ? (
                                    <span className='text-xs text-muted-foreground'>—</span>
                                ) : (
                                    row.items.slice(0, 3).map((it) => <ItemBadge key={it.id} item={it} />)
                                )}
                                {row.items.length > 3 ? (
                                    <Badge variant='outline' className='text-xs'>
                                        +{row.items.length - 3}
                                    </Badge>
                                ) : null}
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={STATUS_VARIANT[row.status]}>{t(`status_${row.status}`)}</Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                            {canEdit || canDelete ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                                            <MoreHorizontal className='h-4 w-4' />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end'>
                                        {canEdit ? (
                                            <DropdownMenuItem onClick={() => onEdit?.(row)}>{t('edit')}</DropdownMenuItem>
                                        ) : null}
                                        {canDelete ? (
                                            <DropdownMenuItem
                                                className='text-destructive focus:text-destructive'
                                                onClick={() => onDelete?.(row)}
                                            >
                                                {t('delete')}
                                            </DropdownMenuItem>
                                        ) : null}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : null}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function ItemBadge({ item }: { item: ScheduleItem }) {
    const t = useTranslations('admin.schedules');
    const locale = useLocale();
    const title = item.resolved
        ? (locale === 'kz' ? item.title_kz : item.title_ru) ?? item.title_ru ?? item.title_kz ?? `#${item.ref_id}`
        : t('item_deleted');
    return (
        <Badge variant={item.resolved ? 'secondary' : 'outline'} className='text-xs'>
            <span className='mr-1 font-medium uppercase opacity-70'>{t(`kind_${item.kind}_short`)}</span>
            <span className='max-w-[150px] truncate'>{title}</span>
        </Badge>
    );
}
