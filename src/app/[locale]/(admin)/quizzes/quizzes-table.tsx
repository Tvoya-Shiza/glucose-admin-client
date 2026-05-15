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
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import type { QuizRow, QuizStatus } from '@/lib/quizzes/types';
import { DuplicateQuizButton } from './components/duplicate-quiz-button';

export interface QuizzesTableProps {
    rows: QuizRow[];
    loading: boolean;
    canMutate: boolean;
    canDelete: boolean;
    onDelete: (row: QuizRow) => void;
    skeletonRowCount?: number;
}

function statusVariant(status: QuizStatus): 'default' | 'destructive' {
    return status === 'active' ? 'default' : 'destructive';
}

/**
 * Quizzes table — TanStack-shaped cells over shadcn primitives.
 *
 * Columns: title (with completeness + version pill), status, category, question_count,
 * attempt, version, created_at, actions.
 *
 * The "title" cell shows ru title (or "—" when missing) + completeness + a v{n} badge.
 * Actions: View (link to /[locale]/quizzes/:id — Plan 04 lands the detail page),
 * Duplicate (admin/teacher), Delete (admin only).
 */
export function QuizzesTable({
    rows,
    loading,
    canMutate,
    canDelete,
    onDelete,
    skeletonRowCount = 10,
}: QuizzesTableProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();

    const columnCount = canMutate ? 8 : 7;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_category')}</TableHead>
                    <TableHead>{t('col_questions')}</TableHead>
                    <TableHead>{t('col_attempts')}</TableHead>
                    <TableHead>{t('col_version')}</TableHead>
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
                                  <div className='flex items-center gap-2'>
                                      <Link
                                          href={`/${locale}/quizzes/${r.id}`}
                                          className='font-medium hover:underline'
                                      >
                                          {`#${r.id}`}
                                      </Link>
                                      <span>{r.title_kz ?? '—'}</span>
                                  </div>
                              </TableCell>
                              <TableCell>
                                  <Badge variant={statusVariant(r.status)}>
                                      {t(`status_${r.status}`)}
                                  </Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                  {r.category?.title_kz ?? '—'}
                              </TableCell>
                              <TableCell className='tabular-nums text-sm'>
                                  {r.question_count}
                              </TableCell>
                              <TableCell className='text-sm'>
                                  {r.attempt == null ? t('attempt_unlimited') : r.attempt}
                              </TableCell>
                              <TableCell>
                                  <Badge variant='outline'>{`v${r.version}`}</Badge>
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
                                                  <Link href={`/${locale}/quizzes/${r.id}`}>
                                                      {t('view_detail')}
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DuplicateQuizButton quizId={r.id} asMenuItem />
                                              {canDelete ? (
                                                  <DropdownMenuItem
                                                      onClick={() => onDelete(r)}
                                                      className='text-destructive'
                                                  >
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
