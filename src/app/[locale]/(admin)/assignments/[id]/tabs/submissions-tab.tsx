'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { DataTablePagination } from '@/components/admin/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GroupPicker } from '@/components/groups/group-picker';
import { listSubmissions } from '@/lib/assignments/api';
import type { SubmissionRow, SubmissionStatus } from '@/lib/assignments/types';
import { useMe } from '@/lib/access/use-me';
import { SubmissionDrawer } from '../components/submission-drawer';

interface SubmissionsTabProps {
    assignmentId: number;
}

const ALL_VALUE = '__all__';

function formatDate(unix: string): string {
    const n = Number(unix);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return new Date(n * 1000).toLocaleString('ru');
}

export function SubmissionsTab({ assignmentId }: SubmissionsTabProps) {
    const t = useTranslations('admin.assignments');

    // Teachers are scoped to their own webinars; the group (поток) filter is hidden for
    // them, mirroring the quiz-results audit page.
    const me = useMe();
    const showGroupFilter = me.data?.role_name !== 'teacher';

    const [{ page, page_size, status, group_id, q }, setQ] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        page_size: parseAsInteger.withDefault(50),
        status: parseAsString,
        group_id: parseAsInteger,
        q: parseAsString,
    });

    const queryKey = useMemo(
        () => ['admin.assignments.submissions', assignmentId, { page, page_size, status, group_id, q }] as const,
        [assignmentId, page, page_size, status, group_id, q],
    );

    const { data, isLoading, isFetching, error } = useQuery({
        queryKey,
        queryFn: () =>
            listSubmissions(assignmentId, {
                page,
                page_size,
                status: (status as SubmissionStatus | null) ?? undefined,
                group_id: group_id ?? undefined,
                q: q ?? undefined,
            }),
        placeholderData: (prev) => prev,
    });

    const rows: SubmissionRow[] = data?.rows ?? [];
    const total = data?.total ?? 0;
    const [openHistoryId, setOpenHistoryId] = useState<number | null>(null);

    const statusLabel = (s: SubmissionStatus) =>
        s === 'pending'
            ? t('submission_status_pending')
            : s === 'passed'
            ? t('submission_status_passed')
            : s === 'not_passed'
            ? t('submission_status_not_passed')
            : t('submission_status_not_submitted');

    return (
        <div className='space-y-4'>
            <div>
                <div className='font-medium'>{t('submissions_title')}</div>
                <div className='text-sm text-muted-foreground'>{t('submissions_subtitle')}</div>
            </div>

            <Card className='p-4'>
                <div className={`grid grid-cols-1 gap-3 ${showGroupFilter ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    <div className='space-y-1.5'>
                        <Label>{t('search_placeholder')}</Label>
                        <Input
                            value={q ?? ''}
                            onChange={(e) => setQ({ page: 1, q: e.target.value.length > 0 ? e.target.value : null })}
                            placeholder={t('search_placeholder')}
                        />
                    </div>
                    <div className='space-y-1.5'>
                        <Label>{t('filter_status')}</Label>
                        <Select
                            value={status ?? ALL_VALUE}
                            onValueChange={(v) =>
                                setQ({ page: 1, status: v === ALL_VALUE ? null : v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>{t('filter_status_all')}</SelectItem>
                                <SelectItem value='pending'>{t('submission_status_pending')}</SelectItem>
                                <SelectItem value='passed'>{t('submission_status_passed')}</SelectItem>
                                <SelectItem value='not_passed'>{t('submission_status_not_passed')}</SelectItem>
                                <SelectItem value='not_submitted'>{t('submission_status_not_submitted')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {showGroupFilter ? (
                        <div className='space-y-1.5'>
                            <Label>{t('filter_group')}</Label>
                            <GroupPicker
                                value={group_id ?? null}
                                onChange={(id) => setQ({ page: 1, group_id: id })}
                                placeholder={t('filter_group_all')}
                            />
                        </div>
                    ) : null}
                </div>
            </Card>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState icon={Inbox} title={t('generic_error')} subtitle={(error as Error).message} />
                ) : isLoading && rows.length === 0 ? (
                    <div className='space-y-2 p-4'>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className='h-10 w-full' />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState icon={Inbox} title={t('submissions_empty')} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('sub_col_student')}</TableHead>
                                <TableHead>{t('sub_col_status')}</TableHead>
                                <TableHead className='text-right'>{t('sub_col_grade')}</TableHead>
                                <TableHead className='text-right'>{t('sub_col_files')}</TableHead>
                                <TableHead>{t('sub_col_submitted')}</TableHead>
                                <TableHead className='text-right'>{t('sub_col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.history_id}>
                                    <TableCell className='font-medium'>
                                        {row.student_name ?? `#${row.student_id}`}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={row.status === 'passed' ? 'default' : 'secondary'}>
                                            {statusLabel(row.status)}
                                        </Badge>
                                        {row.has_curator_reply ? (
                                            <Badge variant='outline' className='ml-2 text-xs'>
                                                ✓
                                            </Badge>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        {row.grade == null ? '—' : row.grade}
                                    </TableCell>
                                    <TableCell className='text-right'>{row.files_count}</TableCell>
                                    <TableCell className='text-sm text-muted-foreground'>
                                        {formatDate(row.submitted_at)}
                                    </TableCell>
                                    <TableCell className='text-right'>
                                        <Button variant='ghost' size='sm' onClick={() => setOpenHistoryId(row.history_id)}>
                                            {t('sub_open')}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {rows.length > 0 || page > 1 ? (
                <DataTablePagination
                    page={page}
                    pageSize={page_size}
                    total={total}
                    rowCount={rows.length}
                    isFetching={isFetching}
                    onPageChange={(p) => setQ({ page: p })}
                    onPageSizeChange={(size) => setQ({ page: 1, page_size: size })}
                />
            ) : null}

            <SubmissionDrawer
                assignmentId={assignmentId}
                historyId={openHistoryId}
                onClose={() => setOpenHistoryId(null)}
            />
        </div>
    );
}
