'use client';

import Link from 'next/link';
import { Eye, EyeOff, MoreHorizontalIcon, Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUnixSecondsOrDash } from '@/lib/courses/format';
import type { TrainerPublishStatus, TrainerRow } from '@/lib/trainers/types';

export interface TrainersTableProps {
    rows: TrainerRow[];
    loading: boolean;
    canMutate: boolean;
    canDelete: boolean;
    canPublish: boolean;
    onDelete: (row: TrainerRow) => void;
    onPublish: (row: TrainerRow) => void;
    skeletonRowCount?: number;
}

function publishVariant(status: TrainerPublishStatus): 'success' | 'muted' {
    return status === 'public' ? 'success' : 'muted';
}

/**
 * Trainers table — shadcn primitives, mirrors QuizzesTable.
 *
 * Columns: title (link → detail), publish status, category, questions, attempts
 * limit, courses count, attempts count, created_at, actions.
 *
 * Row actions (gated in the parent via can* flags): Edit (link to detail),
 * Publish/Hide (toggles publish_status), Delete (soft-delete dialog).
 */
export function TrainersTable({
    rows,
    loading,
    canMutate,
    canDelete,
    canPublish,
    onDelete,
    onPublish,
    skeletonRowCount = 10,
}: TrainersTableProps) {
    const t = useTranslations('admin.trainers');
    const locale = useLocale();

    const columnCount = canMutate ? 9 : 8;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_category')}</TableHead>
                    <TableHead>{t('col_questions')}</TableHead>
                    <TableHead>{t('col_attempts_limit')}</TableHead>
                    <TableHead>{t('col_courses')}</TableHead>
                    <TableHead>{t('col_attempts_count')}</TableHead>
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
                                      <Link href={`/${locale}/trainers/${r.id}`} className='font-medium hover:underline'>
                                          {`#${r.id}`}
                                      </Link>
                                      <span>{r.title_kz ?? '—'}</span>
                                      {r.timer_enabled ? (
                                          <Badge variant='outline' className='gap-1'>
                                              <Timer className='h-3 w-3' />
                                              {r.seconds_per_question ?? '—'}
                                          </Badge>
                                      ) : null}
                                  </div>
                              </TableCell>
                              <TableCell>
                                  <Badge variant={publishVariant(r.publish_status)}>{t(`status_${r.publish_status}`)}</Badge>
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>{r.category?.title_kz ?? '—'}</TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.question_count}</TableCell>
                              <TableCell className='text-sm'>
                                  {r.attempts_limit == null ? t('attempts_unlimited') : r.attempts_limit}
                              </TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.courses.length}</TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.attempts_count}</TableCell>
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
                                                  <Link href={`/${locale}/trainers/${r.id}`}>{t('view_detail')}</Link>
                                              </DropdownMenuItem>
                                              {canPublish ? (
                                                  <DropdownMenuItem onClick={() => onPublish(r)}>
                                                      {r.publish_status === 'public' ? (
                                                          <>
                                                              <EyeOff className='mr-2 h-4 w-4' />
                                                              {t('hide')}
                                                          </>
                                                      ) : (
                                                          <>
                                                              <Eye className='mr-2 h-4 w-4' />
                                                              {t('publish')}
                                                          </>
                                                      )}
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
