'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixDateTimeOrDash } from '@/lib/credits/format';
import { listCellHistory } from '@/lib/rating-journal/api';

export interface CellHistoryTarget {
    columnId: string;
    studentId: number;
    columnTitle: string;
    studentName: string;
}

export interface CellHistoryDialogProps {
    /** null closes the dialog. */
    target: CellHistoryTarget | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * Edit-log viewer for a single cell. Lists кто / когда / было→стало rows from
 * `GET rating-journal/cells/history`. Gated at the call site by
 * <Can permission="rating_journal.history_view">.
 */
export function CellHistoryDialog({ target, onOpenChange }: CellHistoryDialogProps) {
    const t = useTranslations('admin.ratingJournal');
    const locale = useLocale();

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.rating-journal.cell-history', target?.columnId, target?.studentId],
        queryFn: () => listCellHistory({ column_id: target!.columnId, student_id: target!.studentId, page: 1, page_size: 50 }),
        enabled: target != null,
        staleTime: 0,
    });

    const rows = data?.rows ?? [];
    const dash = t('value_dash');

    return (
        <Dialog open={target != null} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('history_title')}</DialogTitle>
                    <DialogDescription>
                        {t('history_description', { student: target?.studentName ?? '', column: target?.columnTitle ?? '' })}
                    </DialogDescription>
                </DialogHeader>
                <div className='max-h-[60vh] overflow-auto'>
                    {isLoading ? (
                        <div className='space-y-2 p-2'>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className='h-6 w-full' />
                            ))}
                        </div>
                    ) : error ? (
                        <p className='text-destructive p-4 text-sm'>{(error as Error).message || t('generic_error')}</p>
                    ) : rows.length === 0 ? (
                        <p className='text-muted-foreground p-6 text-center text-sm'>{t('history_empty')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('history_col_changed_at')}</TableHead>
                                    <TableHead>{t('history_col_changed_by')}</TableHead>
                                    <TableHead>{t('history_col_old')}</TableHead>
                                    <TableHead>{t('history_col_new')}</TableHead>
                                    <TableHead>{t('history_col_source')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className='text-sm'>{formatUnixDateTimeOrDash(r.changed_at, locale)}</TableCell>
                                        <TableCell className='text-sm'>{r.changed_by ?? t('history_system')}</TableCell>
                                        <TableCell className='text-sm'>{r.old_value != null ? r.old_value : dash}</TableCell>
                                        <TableCell className='text-sm font-medium'>{r.new_value != null ? r.new_value : dash}</TableCell>
                                        <TableCell className='text-muted-foreground text-xs'>{r.source}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
