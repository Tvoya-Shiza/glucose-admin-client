'use client';

import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatUnixSecondsOrDash, statusBadgeVariant } from '@/lib/courses/format';
import type { CourseRow } from '@/lib/courses/types';
import { DuplicateCourseButton } from './components/duplicate-course-button';

export interface CoursesTableProps {
    rows: CourseRow[];
    loading: boolean;
    /** Whether the actor can mutate (admin or teacher); shows the Actions column. */
    canMutate: boolean;
    /** Open the delete dialog for a given row. */
    onDelete: (row: CourseRow) => void;
    skeletonRowCount?: number;
}

/**
 * Courses table (CONTEXT D-01) — TanStack-Table-shaped cells over shadcn primitives.
 *
 * Each row's slug links to /[locale]/courses/[id] — Plan 03 owns the detail page.
 * Action menu (Delete) renders only when `canMutate=true`. The Edit action lives on
 * the detail page (Plan 03 owns the edit-in-place pattern), so the dropdown contains
 * only View + Delete in this plan.
 */
export function CoursesTable({
    rows,
    loading,
    canMutate,
    onDelete,
    skeletonRowCount = 10,
}: CoursesTableProps) {
    const t = useTranslations('admin.courses');
    const locale = useLocale();

    const columnCount = canMutate ? 8 : 7;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_id')}</TableHead>
                    <TableHead>{t('col_slug')}</TableHead>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_teacher')}</TableHead>
                    <TableHead>{t('col_category')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
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
                              <TableCell className='font-mono text-xs'>{r.id}</TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.slug}
                              </TableCell>
                              <TableCell>
                                  <Link
                                      href={`/${locale}/courses/${r.id}`}
                                      className='font-medium hover:underline'
                                  >
                                      {r.title_kz ?? '—'}
                                  </Link>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.teacher?.full_name ?? '—'}
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.category ? (r.category.title_kz ?? r.category.slug) : '—'}
                              </TableCell>
                              <TableCell>
                                  <Badge variant={statusBadgeVariant(r.status)}>
                                      {t(`status_${r.status}`)}
                                  </Badge>
                              </TableCell>
                              <TableCell className='text-sm'>
                                  {formatUnixSecondsOrDash(r.created_at, locale)}
                              </TableCell>
                              {canMutate ? (
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
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/${locale}/courses/${r.id}`}>
                                                      {t('view_detail')}
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DuplicateCourseButton courseId={r.id} asMenuItem />
                                              <DropdownMenuItem
                                                  onClick={() => onDelete(r)}
                                                  className='text-destructive'
                                              >
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
