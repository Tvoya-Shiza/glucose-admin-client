'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { UseBulkSelectionApi } from '@/hooks/use-bulk-selection';
import type { StoryRow, StoryStatus } from '@/lib/stories/types';

export interface StoriesTableProps {
    rows: StoryRow[];
    loading: boolean;
    selection: UseBulkSelectionApi<number>;
    onEdit: (row: StoryRow) => void;
    onDelete: (row: StoryRow) => void;
    skeletonRowCount?: number;
}

function formatUnixSecondsOrDash(value: number | null | undefined, locale: string): string {
    if (value == null) return '—';
    const d = new Date(value * 1000);
    const lang = locale === 'kz' ? 'kk-KZ' : 'ru-RU';
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(d);
}

function statusVariant(status: StoryStatus): 'default' | 'secondary' {
    return status === 'publish' ? 'default' : 'secondary';
}

/**
 * STY-01 — stories table.
 *
 * Columns: checkbox (page-scoped via useBulkSelection.togglePageScoped), image
 * thumbnail, id, title_kz, title_kz, status (badge), author,
 * visit_count, created_at, Actions dropdown (Edit + Delete).
 *
 * Image thumbnail: 64x36 cover from `r.image` when present, placeholder div otherwise.
 */
export function StoriesTable({
    rows,
    loading,
    selection,
    onEdit,
    onDelete,
    skeletonRowCount = 10,
}: StoriesTableProps) {
    const t = useTranslations('admin.stories');
    const locale = useLocale();

    const allChecked = selection.isPageAllSelected(rows);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-10'>
                        <Checkbox
                            checked={allChecked}
                            onCheckedChange={() => selection.togglePageScoped(rows)}
                            aria-label='select-all-page'
                            disabled={rows.length === 0}
                        />
                    </TableHead>
                    <TableHead className='w-20'>{t('image_label')}</TableHead>
                    <TableHead>{t('col_id')}</TableHead>
                    <TableHead>{t('col_title_kz')}</TableHead>
                    <TableHead>{t('col_title_kz')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_author')}</TableHead>
                    <TableHead className='text-right'>{t('col_visit_count')}</TableHead>
                    <TableHead>{t('col_created_at')}</TableHead>
                    <TableHead className='w-12'>{t('actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? Array.from({ length: skeletonRowCount }).map((_, i) => (
                          <TableRow key={`sk-${i}`}>
                              <TableCell colSpan={10}>
                                  <Skeleton className='h-6 w-full' />
                              </TableCell>
                          </TableRow>
                      ))
                    : rows.map((r) => (
                          <TableRow key={r.id}>
                              <TableCell>
                                  <Checkbox
                                      checked={selection.isSelected(r.id)}
                                      onCheckedChange={() => selection.toggle(r.id)}
                                      aria-label={`select-${r.id}`}
                                  />
                              </TableCell>
                              <TableCell>
                                  {r.image ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                          src={r.image}
                                          alt=''
                                          className='h-9 w-16 rounded object-cover'
                                      />
                                  ) : (
                                      <div className='h-9 w-16 rounded bg-muted' />
                                  )}
                              </TableCell>
                              <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                              <TableCell className='max-w-[260px] truncate' title={r.title_kz ?? ''}>
                                  {r.title_kz ?? '—'}
                              </TableCell>
                              <TableCell className='max-w-[260px] truncate' title={r.title_kz ?? ''}>
                                  {r.title_kz ?? '—'}
                              </TableCell>
                              <TableCell>
                                  <Badge variant={statusVariant(r.status)}>
                                      {t(`status_badge_${r.status}`)}
                                  </Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.author_full_name ?? '—'}
                              </TableCell>
                              <TableCell className='text-right tabular-nums'>
                                  {r.visit_count}
                              </TableCell>
                              <TableCell className='text-sm'>
                                  {formatUnixSecondsOrDash(r.created_at, locale)}
                              </TableCell>
                              <TableCell>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button
                                              variant='ghost'
                                              size='icon'
                                              aria-label={t('row_actions')}
                                          >
                                              <MoreHorizontalIcon className='h-4 w-4' />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align='end'>
                                          <DropdownMenuItem onClick={() => onEdit(r)}>
                                              {t('edit')}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                              onClick={() => onDelete(r)}
                                              className='text-destructive'
                                          >
                                              {t('delete')}
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    );
}
