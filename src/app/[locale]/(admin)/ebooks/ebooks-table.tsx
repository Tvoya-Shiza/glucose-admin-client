'use client';

import Link from 'next/link';
import { Eye, EyeOff, MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import { resolveAssetUrl } from '@/lib/uploads/asset-url';
import type { BookRow, BookStatus } from '@/lib/ebooks/types';

export interface EbooksTableProps {
    rows: BookRow[];
    loading: boolean;
    canMutate: boolean;
    canDelete: boolean;
    canPublish: boolean;
    onDelete: (row: BookRow) => void;
    onPublish: (row: BookRow, next: BookStatus) => void;
    skeletonRowCount?: number;
}

export function bookStatusVariant(status: BookStatus): 'success' | 'muted' | 'warning' {
    if (status === 'active') return 'success';
    if (status === 'draft') return 'warning';
    return 'muted';
}

/**
 * Ebooks table — shadcn primitives, mirrors TrainersTable.
 *
 * Columns: cover thumb + title (link → detail), status, publisher, subject,
 * grade, year, page count, created_at, actions.
 *
 * Row actions (gated in the parent via can* flags): open detail, publish
 * (→ 'active') / hide (→ 'inactive'), delete (soft-delete dialog). Unlike the
 * trainers' binary toggle, Book.status is a THREE-value enum, so publish and
 * hide are separate items and a 'draft' book offers only "publish".
 */
export function EbooksTable({
    rows,
    loading,
    canMutate,
    canDelete,
    canPublish,
    onDelete,
    onPublish,
    skeletonRowCount = 10,
}: EbooksTableProps) {
    const t = useTranslations('admin.ebooks');
    const locale = useLocale();

    const columnCount = canMutate ? 9 : 8;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_publisher')}</TableHead>
                    <TableHead>{t('col_subject')}</TableHead>
                    <TableHead>{t('col_grade')}</TableHead>
                    <TableHead>{t('col_year')}</TableHead>
                    <TableHead>{t('col_pages')}</TableHead>
                    <TableHead>{t('col_created')}</TableHead>
                    {canMutate ? <TableHead className='w-12'>{t('actions')}</TableHead> : null}
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
                              <TableCell>
                                  <div className='flex items-center gap-3'>
                                      {r.cover_image ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                              src={resolveAssetUrl(r.cover_image)}
                                              alt=''
                                              className='h-10 w-8 shrink-0 rounded border object-cover'
                                          />
                                      ) : (
                                          <div className='bg-muted h-10 w-8 shrink-0 rounded border' />
                                      )}
                                      <div className='flex items-center gap-2'>
                                          <Link href={`/${locale}/ebooks/${r.id}`} className='font-medium hover:underline'>
                                              {`#${r.id}`}
                                          </Link>
                                          <span>{r.title_kz ?? '—'}</span>
                                      </div>
                                  </div>
                              </TableCell>
                              <TableCell>
                                  <Badge variant={bookStatusVariant(r.status)}>{t(`status_${r.status}`)}</Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>{r.publisher?.name ?? '—'}</TableCell>
                              <TableCell className='text-muted-foreground text-sm'>{r.subject?.title_kz ?? '—'}</TableCell>
                              <TableCell className='text-sm'>{r.grade == null ? '—' : t('grade_value', { grade: r.grade })}</TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.year ?? '—'}</TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.page_count}</TableCell>
                              <TableCell className='text-sm'>{formatUnixSecondsOrDash(r.created_at, locale)}</TableCell>
                              {canMutate ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon' aria-label={t('row_actions')}>
                                                  <MoreHorizontalIcon className='h-4 w-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/${locale}/ebooks/${r.id}`}>{t('view_detail')}</Link>
                                              </DropdownMenuItem>
                                              {canPublish && r.status !== 'active' ? (
                                                  <DropdownMenuItem onClick={() => onPublish(r, 'active')}>
                                                      <Eye className='mr-2 h-4 w-4' />
                                                      {t('publish')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                              {canPublish && r.status === 'active' ? (
                                                  <DropdownMenuItem onClick={() => onPublish(r, 'inactive')}>
                                                      <EyeOff className='mr-2 h-4 w-4' />
                                                      {t('hide')}
                                                  </DropdownMenuItem>
                                              ) : null}
                                              {canDelete ? (
                                                  <DropdownMenuItem onClick={() => onDelete(r)} className='text-destructive'>
                                                      {t('delete')}
                                                  </DropdownMenuItem>
                                              ) : null}
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
