'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    deleteAnswer,
    ForceConfirmRequiredError,
    upsertAnswer,
} from '@/lib/quizzes/api';
import type { AnswerDetail, UpsertAnswer } from '@/lib/quizzes/types';
import { ForceConfirmDialog } from './force-confirm-dialog';

export interface IdentificativePairsEditorProps {
    quizId: number;
    questionId: number;
    answers: AnswerDetail[];
}

interface Pair {
    left: AnswerDetail;
    right: AnswerDetail | null;
}

export function IdentificativePairsEditor({
    quizId,
    questionId,
    answers,
}: IdentificativePairsEditorProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const [adding, setAdding] = useState(false);

    const lefts = answers.filter((a) => a.parent_id == null);
    const rightsByParent = new Map<number, AnswerDetail>();
    for (const a of answers) {
        if (a.parent_id != null) rightsByParent.set(a.parent_id, a);
    }
    const pairs: Pair[] = lefts.map((l) => ({
        left: l,
        right: rightsByParent.get(l.id) ?? null,
    }));

    const handleAddPair = async () => {
        setAdding(true);
        try {
            const leftRes = await upsertAnswer(quizId, questionId, {
                question_id: questionId,
                parent_id: null,
                correct: true,
                image: null,
                translations: [{ locale: 'kz', title: ' ' }],
            });
            await upsertAnswer(quizId, questionId, {
                question_id: questionId,
                parent_id: leftRes.answer.id,
                correct: true,
                image: null,
                translations: [{ locale: 'kz', title: ' ' }],
            });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            toast.success(t('saved'));
        } catch (err) {
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between'>
                <Label className='text-sm font-semibold'>
                    {t('answers_count', { count: pairs.length })}
                </Label>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={handleAddPair}
                    disabled={adding}
                >
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_pair')}
                </Button>
            </div>

            {pairs.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-3 text-center text-sm'>
                    {t('no_answers_yet')}
                </div>
            ) : (
                <div className='space-y-2'>
                    {pairs.map((p, idx) => (
                        <PairRow
                            key={p.left.id}
                            quizId={quizId}
                            questionId={questionId}
                            pair={p}
                            index={idx + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface PairRowProps {
    quizId: number;
    questionId: number;
    pair: Pair;
    index: number;
}

function PairRow({ quizId, questionId, pair, index }: PairRowProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [leftKz, setLeftKz] = useState(
        pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '',
    );
    const [rightKz, setRightKz] = useState(
        pair.right?.translations.find((x) => x.locale === 'kz')?.title ?? '',
    );

    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingPayload, setPendingPayload] = useState<{
        side: 'left' | 'right';
        payload: UpsertAnswer;
    } | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{
        answerId: number;
        token?: string;
        afterRightDelete?: boolean;
    } | null>(null);
    const [pendingToken, setPendingToken] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (pending) return;
        setLeftKz(pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '');
        setRightKz(pair.right?.translations.find((x) => x.locale === 'kz')?.title ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pair.left.id, pair.right?.id]);

    const updateMutation = useMutation({
        mutationFn: (payload: UpsertAnswer) => upsertAnswer(quizId, questionId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
        },
    });

    const submit = async (side: 'left' | 'right', payload: UpsertAnswer) => {
        setPending(true);
        try {
            await updateMutation.mutateAsync(payload);
            toast.success(t('saved'));
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload({ side, payload });
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setPendingDelete(null);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setPending(false);
        }
    };

    const buildLeft = (): UpsertAnswer => ({
        id: pair.left.id,
        question_id: questionId,
        parent_id: null,
        correct: pair.left.correct,
        image: pair.left.image ?? null,
        translations: [{ locale: 'kz', title: leftKz.length > 0 ? leftKz : ' ' }],
    });

    const buildRight = (): UpsertAnswer | null => {
        if (!pair.right) return null;
        return {
            id: pair.right.id,
            question_id: questionId,
            parent_id: pair.left.id,
            correct: pair.right.correct,
            image: pair.right.image ?? null,
            translations: [{ locale: 'kz', title: rightKz.length > 0 ? rightKz : ' ' }],
        };
    };

    const onLeftBlur = () => {
        const kzDirty =
            leftKz !== (pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '');
        if (!kzDirty) return;
        if (!leftKz.trim()) return;
        submit('left', buildLeft());
    };

    const onRightBlur = async () => {
        if (!pair.right) {
            // Orphan LEFT — create the missing RIGHT lazily once user types.
            if (!rightKz.trim()) return;
            setPending(true);
            try {
                await upsertAnswer(quizId, questionId, {
                    question_id: questionId,
                    parent_id: pair.left.id,
                    correct: true,
                    image: null,
                    translations: [{ locale: 'kz', title: rightKz }],
                });
                toast.success(t('saved'));
                qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
                qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            } catch (err) {
                toast.error((err as Error).message ?? t('save_failed'));
            } finally {
                setPending(false);
            }
            return;
        }
        const kzDirty =
            rightKz !== (pair.right.translations.find((x) => x.locale === 'kz')?.title ?? '');
        if (!kzDirty) return;
        const payload = buildRight();
        if (!payload) return;
        submit('right', payload);
    };

    const handleRemovePair = async () => {
        if (!window.confirm(t('delete_answer_confirm'))) return;
        setPending(true);
        try {
            if (pair.right) {
                try {
                    await deleteAnswer(quizId, questionId, pair.right.id);
                } catch (err) {
                    if (err instanceof ForceConfirmRequiredError) {
                        setPendingDelete({
                            answerId: pair.right.id,
                            afterRightDelete: false,
                        });
                        setPendingToken(err.force_confirm_token);
                        setForceCount(err.open_attempts_count);
                        setPendingPayload(null);
                        setForceDialogOpen(true);
                        return;
                    }
                    throw err;
                }
            }
            try {
                await deleteAnswer(quizId, questionId, pair.left.id);
                toast.success(t('saved'));
                qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
                qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            } catch (err) {
                if (err instanceof ForceConfirmRequiredError) {
                    setPendingDelete({
                        answerId: pair.left.id,
                        afterRightDelete: true,
                    });
                    setPendingToken(err.force_confirm_token);
                    setForceCount(err.open_attempts_count);
                    setPendingPayload(null);
                    setForceDialogOpen(true);
                    return;
                }
                throw err;
            }
        } catch (err) {
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setPending(false);
        }
    };

    const onForceConfirm = async () => {
        if (!pendingToken) return;
        setPending(true);
        try {
            if (pendingDelete) {
                await deleteAnswer(quizId, questionId, pendingDelete.answerId, pendingToken);
                if (!pendingDelete.afterRightDelete && pair.right?.id === pendingDelete.answerId) {
                    setForceDialogOpen(false);
                    setPendingToken(null);
                    setPendingDelete(null);
                    try {
                        await deleteAnswer(quizId, questionId, pair.left.id);
                        toast.success(t('saved'));
                        qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
                        qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
                    } catch (err) {
                        if (err instanceof ForceConfirmRequiredError) {
                            setPendingDelete({
                                answerId: pair.left.id,
                                afterRightDelete: true,
                            });
                            setPendingToken(err.force_confirm_token);
                            setForceCount(err.open_attempts_count);
                            setForceDialogOpen(true);
                        } else {
                            toast.error((err as Error).message ?? t('save_failed'));
                        }
                    }
                } else {
                    toast.success(t('saved'));
                    qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
                    qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
                    setForceDialogOpen(false);
                    setPendingToken(null);
                    setPendingDelete(null);
                }
                return;
            }
            if (pendingPayload) {
                await updateMutation.mutateAsync({
                    ...pendingPayload.payload,
                    force_confirm_token: pendingToken,
                });
                toast.success(t('saved'));
                setForceDialogOpen(false);
                setPendingPayload(null);
                setPendingToken(null);
            }
        } catch (err) {
            const msg = (err as Error).message ?? '';
            if (msg.includes('force_confirm.token_already_used')) {
                toast.error(t('force_confirm_token_already_used'));
            } else if (msg.includes('force_confirm.payload_changed')) {
                toast.error(t('force_confirm_payload_changed'));
            } else if (msg.includes('force_confirm')) {
                toast.error(t('force_confirm_invalid'));
            } else {
                toast.error(msg || t('save_failed'));
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <div className='bg-card space-y-2 rounded-lg border p-3'>
            <div className='flex items-center justify-between'>
                <Label className='text-sm font-semibold'>
                    {t('pair_label_n', { n: index })}
                    {!pair.right ? (
                        <span className='text-muted-foreground ml-2 text-xs'>
                            ({t('orphan_pair_warning')})
                        </span>
                    ) : null}
                </Label>
                <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={handleRemovePair}
                    disabled={pending}
                >
                    <Trash className='mr-1 h-4 w-4' />
                    {t('remove_pair')}
                </Button>
            </div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                <div className='space-y-2 rounded border p-2'>
                    <Label className='text-muted-foreground text-xs uppercase'>
                        {t('identificative_left_column')}
                    </Label>
                    <div className='space-y-1'>
                        <Label className='text-muted-foreground text-xs'>
                            {t('kz_translation')}
                        </Label>
                        <Input
                            value={leftKz}
                            onChange={(e) => setLeftKz(e.target.value)}
                            onBlur={onLeftBlur}
                            placeholder={t('identificative_left_placeholder')}
                            disabled={pending}
                        />
                    </div>
                </div>
                <div className='space-y-2 rounded border p-2'>
                    <Label className='text-muted-foreground text-xs uppercase'>
                        {t('identificative_right_column')}
                    </Label>
                    <div className='space-y-1'>
                        <Label className='text-muted-foreground text-xs'>
                            {t('kz_translation')}
                        </Label>
                        <Input
                            value={rightKz}
                            onChange={(e) => setRightKz(e.target.value)}
                            onBlur={onRightBlur}
                            placeholder={t('identificative_right_placeholder')}
                            disabled={pending}
                        />
                    </div>
                </div>
            </div>
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={(open) => {
                    setForceDialogOpen(open);
                    if (!open) {
                        setPendingPayload(null);
                        setPendingDelete(null);
                        setPendingToken(null);
                    }
                }}
                openAttemptsCount={forceCount}
                onConfirm={onForceConfirm}
                isPending={pending}
            />
        </div>
    );
}
