'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AssignmentRow } from '@/lib/assignments/types';

export interface AssignmentsTableProps {
    rows: AssignmentRow[];
    loading?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    onEdit?: (row: AssignmentRow) => void;
    onDelete?: (row: AssignmentRow) => void;
}

function formatDate(unix: string | number | null): string {
    if (unix == null) return '—';
    const n = typeof unix === 'string' ? Number(unix) : unix;
    if (!Number.isFinite(n) || n <= 0) return '—';
    return new Date(n * 1000).toLocaleDateString('ru');
}

export function AssignmentsTable({ rows, loading, canEdit, canDelete, onEdit, onDelete }: AssignmentsTableProps) {
    const t = useTranslations('admin.assignments');

    if (loading && rows.length === 0) {
        return (
            <div className='space-y-2 p-4'>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-10 w-full' />
                ))}
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('col_title')}</TableHead>
                    <TableHead>{t('col_status')}</TableHead>
                    <TableHead>{t('col_course')}</TableHead>
                    <TableHead className='text-right'>{t('col_submissions')}</TableHead>
                    <TableHead className='text-right'>{t('col_pending')}</TableHead>
                    <TableHead>{t('col_deadline')}</TableHead>
                    <TableHead className='text-right'>{t('col_attachments')}</TableHead>
                    <TableHead>{t('col_created')}</TableHead>
                    <TableHead className='text-right'>{t('col_actions')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const title = row.title_kz ?? row.title_ru ?? `#${row.id}`;
                    return (
                        <TableRow key={row.id}>
                            <TableCell className='font-medium'>
                                <Link href={`/assignments/${row.id}`} className='hover:underline'>
                                    {title}
                                </Link>
                                {row.translation_completeness === 'incomplete' ? (
                                    <Badge variant='outline' className='ml-2 text-xs'>
                                        {t('translation_incomplete')}
                                    </Badge>
                                ) : null}
                            </TableCell>
                            <TableCell>
                                <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                                    {row.status === 'active' ? t('status_active') : t('status_inactive')}
                                </Badge>
                            </TableCell>
                            <TableCell className='text-sm text-muted-foreground'>
                                {row.webinar_title_ru ?? `#${row.webinar_id}`}
                            </TableCell>
                            <TableCell className='text-right'>{row.submission_count}</TableCell>
                            <TableCell className='text-right'>
                                {row.pending_review_count > 0 ? (
                                    <Badge variant='outline' className='border-orange-300 text-orange-700'>
                                        {row.pending_review_count}
                                    </Badge>
                                ) : (
                                    <span className='text-muted-foreground'>—</span>
                                )}
                            </TableCell>
                            <TableCell>{formatDate(row.deadline)}</TableCell>
                            <TableCell className='text-right'>{row.attachment_count}</TableCell>
                            <TableCell className='text-sm text-muted-foreground'>{formatDate(row.created_at)}</TableCell>
                            <TableCell className='text-right'>
                                <div className='flex justify-end gap-2'>
                                    <Button asChild variant='ghost' size='sm'>
                                        <Link href={`/assignments/${row.id}`}>{t('open_detail')}</Link>
                                    </Button>
                                    {canEdit ? (
                                        <Button variant='ghost' size='sm' onClick={() => onEdit?.(row)}>
                                            {t('edit')}
                                        </Button>
                                    ) : null}
                                    {canDelete ? (
                                        <Button variant='ghost' size='sm' onClick={() => onDelete?.(row)}>
                                            {t('delete')}
                                        </Button>
                                    ) : null}
                                </div>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
