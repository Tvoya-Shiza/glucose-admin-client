'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import type { PublisherRow } from '@/lib/ebooks/types';

export interface PublishersTableProps {
    rows: PublisherRow[];
    loading: boolean;
    canEdit: boolean;
    onEdit: (row: PublisherRow) => void;
    onDelete: (row: PublisherRow) => void;
    skeletonRowCount?: number;
}

/** Publishers reference table — name, linked book count, timestamps, row actions. */
export function PublishersTable({ rows, loading, canEdit, onEdit, onDelete, skeletonRowCount = 10 }: PublishersTableProps) {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();

    const columnCount = canEdit ? 5 : 4;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-20'>{t('publishers_col_id')}</TableHead>
                    <TableHead>{t('publishers_col_name')}</TableHead>
                    <TableHead>{t('publishers_col_books')}</TableHead>
                    <TableHead>{t('col_created')}</TableHead>
                    {canEdit ? <TableHead className='w-12'>{t('actions')}</TableHead> : null}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={columnCount}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => (
                          <TableRow key={r.id}>
                              <TableCell className='text-muted-foreground tabular-nums text-sm'>{`#${r.id}`}</TableCell>
                              <TableCell className='font-medium'>{r.name}</TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.book_count}</TableCell>
                              <TableCell className='text-sm'>{formatUnixSecondsOrDash(r.created_at, locale)}</TableCell>
                              {canEdit ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon' aria-label={t('row_actions')}>
                                                  <MoreHorizontalIcon className='h-4 w-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              <DropdownMenuItem onClick={() => onEdit(r)}>{t('edit')}</DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => onDelete(r)} className='text-destructive'>
                                                  {t('delete')}
                                              </DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                  </TableCell>
                              ) : null}
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}
