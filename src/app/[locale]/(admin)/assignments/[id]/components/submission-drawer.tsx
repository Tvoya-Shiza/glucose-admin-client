'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/lib/access/use-permission';
import { getSubmission, gradeSubmission, replyToSubmission } from '@/lib/assignments/api';
import type { SubmissionDetail, SubmissionStatus } from '@/lib/assignments/types';

interface SubmissionDrawerProps {
    assignmentId: number;
    historyId: number | null;
    onClose: () => void;
}

function formatDateTime(unix: string): string {
    const n = Number(unix);
    if (!Number.isFinite(n) || n <= 0) return '—';
    return new Date(n * 1000).toLocaleString('ru');
}

export function SubmissionDrawer({ assignmentId, historyId, onClose }: SubmissionDrawerProps) {
    const t = useTranslations('admin.assignments');
    const qc = useQueryClient();
    const open = historyId !== null;
    const canGrade = usePermission('assignments.grade');

    const { data, isLoading } = useQuery<SubmissionDetail>({
        queryKey: ['admin.assignments.submission', assignmentId, historyId],
        queryFn: () => getSubmission(assignmentId, historyId!),
        enabled: open,
    });

    const [replyText, setReplyText] = useState('');
    const [gradeStatus, setGradeStatus] = useState<SubmissionStatus>('passed');
    const [gradeValue, setGradeValue] = useState('');
    const [gradeComment, setGradeComment] = useState('');

    useEffect(() => {
        if (data) {
            setGradeStatus(data.status);
            setGradeValue(data.grade == null ? '' : String(data.grade));
            setGradeComment('');
            setReplyText('');
        }
    }, [data]);

    const reply = useMutation({
        mutationFn: async () => replyToSubmission(assignmentId, historyId!, replyText.trim()),
        onSuccess: () => {
            toast.success(t('reply_sent'));
            setReplyText('');
            qc.invalidateQueries({ queryKey: ['admin.assignments.submission', assignmentId, historyId] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.submissions', assignmentId] });
        },
        onError: (e: Error) => toast.error(t('reply_failed'), { description: e.message }),
    });

    const grade = useMutation({
        mutationFn: async () =>
            gradeSubmission(assignmentId, historyId!, {
                status: gradeStatus,
                grade: gradeValue.trim().length > 0 ? Number(gradeValue) : undefined,
                comment: gradeComment.trim().length > 0 ? gradeComment.trim() : undefined,
            }),
        onSuccess: () => {
            toast.success(t('grade_success'));
            setGradeComment('');
            qc.invalidateQueries({ queryKey: ['admin.assignments.submission', assignmentId, historyId] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.submissions', assignmentId] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail', assignmentId] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.analytics'] });
        },
        onError: (e: Error) => toast.error(t('grade_failed'), { description: e.message }),
    });

    const statusLabel = (s: SubmissionStatus) =>
        s === 'pending'
            ? t('submission_status_pending')
            : s === 'passed'
            ? t('submission_status_passed')
            : s === 'not_passed'
            ? t('submission_status_not_passed')
            : t('submission_status_not_submitted');

    return (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className='w-full max-w-2xl overflow-y-auto sm:max-w-2xl'>
                <SheetHeader>
                    <SheetTitle>{t('sub_drawer_title')}</SheetTitle>
                    <SheetDescription>
                        {data ? (
                            <span className='flex items-center gap-2'>
                                <span className='font-medium text-foreground'>
                                    {data.student_name ?? `#${data.student_id}`}
                                </span>
                                <Badge variant={data.status === 'passed' ? 'default' : 'secondary'}>
                                    {statusLabel(data.status)}
                                </Badge>
                                {data.grade != null ? (
                                    <span className='text-foreground'>
                                        {t('sub_drawer_grade')}: {data.grade}
                                    </span>
                                ) : null}
                            </span>
                        ) : (
                            t('loading')
                        )}
                    </SheetDescription>
                </SheetHeader>

                {isLoading || !data ? (
                    <div className='mt-4 space-y-2'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className='h-16 w-full' />
                        ))}
                    </div>
                ) : (
                    <div className='mt-4 space-y-4'>
                        <div>
                            <div className='mb-2 text-xs uppercase tracking-wide text-muted-foreground'>
                                {t('sub_drawer_messages')}
                            </div>
                            {data.messages.length === 0 ? (
                                <div className='rounded border border-dashed py-6 text-center text-sm text-muted-foreground'>
                                    {t('sub_drawer_no_messages')}
                                </div>
                            ) : (
                                <ul className='space-y-2'>
                                    {data.messages.map((m) => {
                                        const isStudent = m.sender_role === 'student';
                                        return (
                                            <li
                                                key={m.id}
                                                className={`rounded border p-3 ${
                                                    isStudent ? 'bg-muted/40' : 'border-primary/30 bg-primary/5'
                                                }`}
                                            >
                                                <div className='mb-1 flex items-center justify-between text-xs text-muted-foreground'>
                                                    <span>
                                                        <strong className='text-foreground'>
                                                            {isStudent
                                                                ? t('sub_drawer_student_label')
                                                                : t('sub_drawer_curator_label')}
                                                        </strong>
                                                        {' · '}
                                                        {m.sender_name ?? `#${m.sender_id}`}
                                                    </span>
                                                    <span>{formatDateTime(m.created_at)}</span>
                                                </div>
                                                {m.message ? (
                                                    <div className='whitespace-pre-wrap text-sm'>{m.message}</div>
                                                ) : null}
                                                {m.file_path ? (
                                                    <a
                                                        href={m.file_path}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                        className='mt-2 inline-flex items-center gap-1 text-xs underline'
                                                    >
                                                        <Download className='h-3 w-3' />
                                                        {m.file_title ?? t('sub_drawer_download_file')}
                                                    </a>
                                                ) : null}
                                                {m.curator_comment ? (
                                                    <div className='mt-2 rounded bg-background/60 p-2 text-xs italic text-muted-foreground'>
                                                        {m.curator_comment}
                                                    </div>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {canGrade ? (
                            <>
                                <div className='space-y-2 rounded border p-3'>
                                    <div className='text-sm font-medium'>{t('grade_dialog_title')}</div>
                                    <div className='grid grid-cols-2 gap-3'>
                                        <div className='space-y-1.5'>
                                            <Label>{t('grade_dialog_status')}</Label>
                                            <Select
                                                value={gradeStatus}
                                                onValueChange={(v) => setGradeStatus(v as SubmissionStatus)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='pending'>{t('submission_status_pending')}</SelectItem>
                                                    <SelectItem value='passed'>{t('submission_status_passed')}</SelectItem>
                                                    <SelectItem value='not_passed'>{t('submission_status_not_passed')}</SelectItem>
                                                    <SelectItem value='not_submitted'>{t('submission_status_not_submitted')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label>{t('grade_dialog_grade')}</Label>
                                            <Input
                                                type='number'
                                                min={0}
                                                value={gradeValue}
                                                onChange={(e) => setGradeValue(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label>{t('grade_dialog_comment')}</Label>
                                        <Textarea
                                            rows={3}
                                            value={gradeComment}
                                            onChange={(e) => setGradeComment(e.target.value)}
                                            placeholder={t('grade_dialog_comment_placeholder')}
                                        />
                                    </div>
                                    <div className='flex justify-end'>
                                        <Button onClick={() => grade.mutate()} disabled={grade.isPending}>
                                            {grade.isPending ? t('saving_dot') : t('grade_dialog_submit')}
                                        </Button>
                                    </div>
                                </div>

                                <div className='space-y-2 rounded border p-3'>
                                    <div className='text-sm font-medium'>{t('sub_drawer_reply_action')}</div>
                                    <Textarea
                                        rows={3}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder={t('sub_drawer_reply_placeholder')}
                                    />
                                    <div className='flex justify-end'>
                                        <Button
                                            onClick={() => reply.mutate()}
                                            disabled={reply.isPending || replyText.trim().length === 0}
                                        >
                                            {reply.isPending ? t('saving_dot') : t('sub_drawer_reply_send')}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
