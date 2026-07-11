'use client';

import { ImageIcon, MoreHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DifficultyBadge } from '@/components/credits/difficulty-badge';
import type { CreditQuestionRow } from '@/lib/credits/types';

/** Strip Tiptap HTML to a plain-text preview for the table cell. */
function htmlToPlainText(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface QuestionsTableProps {
    rows: CreditQuestionRow[];
    loading: boolean;
    canManage: boolean;
    /** Question DELETE is admin-only on the server (@Roles('admin')). */
    canDelete: boolean;
    onEdit: (row: CreditQuestionRow) => void;
    onToggleArchive: (row: CreditQuestionRow) => void;
    onDelete: (row: CreditQuestionRow) => void;
    skeletonRowCount?: number;
}

/** Question bank table: id, topic, difficulty, truncated question, score, status. */
export function QuestionsTable({
    rows,
    loading,
    canManage,
    canDelete,
    onEdit,
    onToggleArchive,
    onDelete,
    skeletonRowCount = 10,
}: QuestionsTableProps) {
    const t = useTranslations('admin.credit_questions');

    const showActions = canManage || canDelete;
    const columnCount = showActions ? 7 : 6;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className='w-20'>{t('col_id')}</TableHead>
                    <TableHead>{t('col_topic')}</TableHead>
                    <TableHead>{t('col_difficulty')}</TableHead>
                    <TableHead>{t('col_question')}</TableHead>
                    <TableHead>{t('col_score')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    {showActions ? <TableHead className='w-12'>{t('row_actions')}</TableHead> : null}
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
                              <TableCell className='text-muted-foreground text-xs'>#{r.id}</TableCell>
                              <TableCell className='text-sm'>{r.topic?.name ?? '—'}</TableCell>
                              <TableCell>
                                  <DifficultyBadge difficulty={r.difficulty} />
                              </TableCell>
                              <TableCell className='max-w-md'>
                                  <div className='flex items-start gap-2'>
                                      {r.question_image ? (
                                          <ImageIcon className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-label={t('has_photo')} />
                                      ) : null}
                                      <span className='line-clamp-2 text-sm'>{htmlToPlainText(r.question)}</span>
                                  </div>
                              </TableCell>
                              <TableCell className='tabular-nums text-sm'>{r.score}</TableCell>
                              <TableCell>
                                  <Badge variant={r.status === 'active' ? 'success' : 'muted'}>{t(`status_${r.status}`)}</Badge>
                              </TableCell>
                              {showActions ? (
                                  <TableCell>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant='ghost' size='icon' aria-label={t('row_actions')}>
                                                  <MoreHorizontalIcon className='h-4 w-4' />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                              {canManage ? (
                                                  <>
                                                      <DropdownMenuItem onClick={() => onEdit(r)}>{t('edit')}</DropdownMenuItem>
                                                      <DropdownMenuItem onClick={() => onToggleArchive(r)}>
                                                          {r.status === 'active' ? t('archive') : t('restore')}
                                                      </DropdownMenuItem>
                                                  </>
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
