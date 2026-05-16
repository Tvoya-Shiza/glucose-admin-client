'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DataTablePaginationProps {
    page: number;
    pageSize: number;
    total?: number;
    /**
     * Current page's row count. When `total` is unknown, the next button is
     * disabled if `rowCount < pageSize`.
     */
    rowCount?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
    isFetching?: boolean;
    className?: string;
}

export function DataTablePagination({
    page,
    pageSize,
    total,
    rowCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100],
    isFetching = false,
    className,
}: DataTablePaginationProps) {
    const t = useTranslations('admin.pagination');

    const knowsTotal = typeof total === 'number';
    const totalPages = knowsTotal ? Math.max(1, Math.ceil((total as number) / pageSize)) : undefined;
    const from = knowsTotal && (total as number) > 0 ? (page - 1) * pageSize + 1 : 0;
    const to = knowsTotal ? Math.min(page * pageSize, total as number) : (page - 1) * pageSize + (rowCount ?? 0);

    const canPrev = page > 1;
    const canNext = knowsTotal ? page < (totalPages as number) : (rowCount ?? 0) >= pageSize;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 border-t border-border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            <div className='flex items-center gap-4 text-muted-foreground'>
                <span className='tabular-nums'>
                    {isFetching
                        ? t('loading')
                        : knowsTotal
                          ? t('range', { from, to, total: total as number })
                          : t('page_only', { page })}
                </span>
                {onPageSizeChange && (
                    <div className='flex items-center gap-2'>
                        <span className='hidden text-xs sm:inline'>{t('rows_per_page')}</span>
                        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                            <SelectTrigger className='h-8 w-[72px]'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pageSizeOptions.map((opt) => (
                                    <SelectItem key={opt} value={String(opt)}>
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <div className='flex items-center gap-1'>
                {knowsTotal && (
                    <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        disabled={!canPrev}
                        onClick={() => onPageChange(1)}
                        aria-label='First page'
                    >
                        <ChevronsLeft size={16} />
                    </Button>
                )}
                <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8'
                    disabled={!canPrev}
                    onClick={() => onPageChange(page - 1)}
                    aria-label='Previous page'
                >
                    <ChevronLeft size={16} />
                </Button>
                <span className='px-2 text-xs tabular-nums text-muted-foreground'>
                    {knowsTotal ? t('page_of', { page, totalPages: totalPages as number }) : t('page_only', { page })}
                </span>
                <Button
                    variant='outline'
                    size='icon'
                    className='h-8 w-8'
                    disabled={!canNext}
                    onClick={() => onPageChange(page + 1)}
                    aria-label='Next page'
                >
                    <ChevronRight size={16} />
                </Button>
                {knowsTotal && (
                    <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        disabled={!canNext}
                        onClick={() => onPageChange(totalPages as number)}
                        aria-label='Last page'
                    >
                        <ChevronsRight size={16} />
                    </Button>
                )}
            </div>
        </div>
    );
}
