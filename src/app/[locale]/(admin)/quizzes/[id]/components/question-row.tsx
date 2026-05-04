'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteQuestion, ForceConfirmRequiredError } from '@/lib/quizzes/api';
import type { QuestionDetail } from '@/lib/quizzes/types';
import { ForceConfirmDialog } from './force-confirm-dialog';
import { UpsertQuestionDialog } from './upsert-question-dialog';

/**
 * QuestionRow — one row in the QuestionsList (Phase 6 Plan 05).
 *
 * Drag handle: dnd-kit sortable on `question-${id}`. Reorder commits via the
 * parent QuestionsList's onDragEnd handler (single PATCH on
 * /admin-api/v1/admin/quizzes/:id/questions/reorder — non-destructive per D-11).
 *
 * Row actions:
 *   - Edit → opens UpsertQuestionDialog in edit mode
 *   - Delete → confirm prompt; on 409 ForceConfirmRequiredError, opens
 *     ForceConfirmDialog → on confirm re-DELETE with force_confirm_token.
 *
 * Shows: order index, type badge, grade badge, RU title (truncated), KZ
 * presence indicator, answer count.
 */
export interface QuestionRowProps {
    quizId: number;
    question: QuestionDetail;
    index: number;
}

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
    single: 'default',
    multiple: 'secondary',
    descriptive: 'outline',
    identificative: 'outline',
};

export function QuestionRow({ quizId, question, index }: QuestionRowProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `question-${question.id}`,
        data: { type: 'question', questionId: question.id },
    });

    const [editOpen, setEditOpen] = useState(false);
    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingToken, setPendingToken] = useState<string | null>(null);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const deleteMutation = useMutation({
        mutationFn: (token: string | undefined) => deleteQuestion(quizId, question.id, token),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            setForceDialogOpen(false);
            setPendingToken(null);
        },
    });

    const handleDelete = async () => {
        if (typeof window !== 'undefined' && !window.confirm(t('delete_question_confirm'))) {
            return;
        }
        try {
            await deleteMutation.mutateAsync(undefined);
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        }
    };

    const handleForceConfirm = async () => {
        if (!pendingToken) return;
        try {
            await deleteMutation.mutateAsync(pendingToken);
        } catch (err) {
            const msg = (err as Error).message ?? '';
            if (msg.includes('force_confirm.token_already_used')) {
                toast.error(t('force_confirm_token_already_used'));
            } else if (msg.includes('force_confirm')) {
                toast.error(t('force_confirm_invalid'));
            } else {
                toast.error(msg || t('save_failed'));
            }
        }
    };

    const ruTitle = question.translations.find((tr) => tr.locale === 'ru')?.title ?? '';
    const truncatedTitle =
        ruTitle.length > 80 ? `${ruTitle.slice(0, 80)}…` : ruTitle.length > 0 ? ruTitle : `#${question.id}`;
    const hasKz = (question.translations.find((tr) => tr.locale === 'kz')?.title ?? '').length > 0;

    return (
        <>
            <div ref={setNodeRef} style={style} className='bg-card flex items-center gap-2 rounded-lg border p-3'>
                <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground cursor-grab touch-none p-1.5'
                    aria-label={t('drag_handle_aria')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className='h-4 w-4' />
                </button>
                <span className='text-muted-foreground w-6 shrink-0 text-center text-xs tabular-nums'>
                    {index + 1}
                </span>
                <Badge variant={TYPE_VARIANT[question.type] ?? 'outline'} className='shrink-0'>
                    {t(`q_type_${question.type}` as 'q_type_single')}
                </Badge>
                <Badge variant='outline' className='shrink-0'>
                    {question.grade}
                </Badge>
                <div className='min-w-0 flex-1 truncate text-sm'>{truncatedTitle}</div>
                {!hasKz ? (
                    <Badge variant='destructive' className='shrink-0 text-xs'>
                        {t('missing_kz')}
                    </Badge>
                ) : null}
                <span className='text-muted-foreground shrink-0 text-xs'>
                    {t('answers_count', { count: question.answers.length })}
                </span>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={() => setEditOpen(true)}
                >
                    <Pencil className='h-4 w-4' />
                </Button>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                >
                    <Trash className='h-4 w-4' />
                </Button>
            </div>
            {editOpen ? (
                <UpsertQuestionDialog
                    quizId={quizId}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    question={question}
                />
            ) : null}
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={(o) => {
                    setForceDialogOpen(o);
                    if (!o) setPendingToken(null);
                }}
                openAttemptsCount={forceCount}
                onConfirm={handleForceConfirm}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}
