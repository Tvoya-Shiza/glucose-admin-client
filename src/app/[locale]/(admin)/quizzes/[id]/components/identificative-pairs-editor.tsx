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

/**
 * IdentificativePairsEditor — TWO-COLUMN pair editor (Phase 6 Plan 05, D-07).
 *
 * Schema model: identificative-type questions encode pairs via
 * QuizQuestionAnswer.parent_id self-FK.
 *   - LEFT (anchor) row:  parent_id = null,  correct = true
 *   - RIGHT (match) row:  parent_id = LEFT.id, correct = true
 *
 * The editor reconstructs pairs from the flat answers array: for each LEFT,
 * find the RIGHT whose parent_id === LEFT.id. Orphan LEFT rows (no matching
 * RIGHT) render with an inline warning badge but are still editable.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  TWO-CALL DANCE — Add pair / Remove pair                              ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  ADD PAIR:                                                             ║
 * ║    1. POST LEFT (parent_id = null) → returns LEFT.id                  ║
 * ║    2. POST RIGHT (parent_id = LEFT.id)                                 ║
 * ║                                                                        ║
 * ║  Both POSTs are NON-DESTRUCTIVE per D-11 ("create answer" is additive ║
 * ║  even for identificative; the in-flight grader uses the version       ║
 * ║  snapshot at attempt start). No force_confirm flow needed for ADD.    ║
 * ║                                                                        ║
 * ║  REMOVE PAIR:                                                          ║
 * ║    1. DELETE RIGHT  (cascade in schema would also work, but explicit  ║
 * ║       ordering keeps audit log entries clean: one delete per pair-    ║
 * ║       half operation).                                                 ║
 * ║    2. DELETE LEFT                                                      ║
 * ║                                                                        ║
 * ║  Both deletes ARE destructive per D-11. Each may 409 with a fresh     ║
 * ║  force_confirm_token. Worst case: TWO force-confirm dialogs per       ║
 * ║  pair removal (RIGHT delete first, then LEFT delete). The token's     ║
 * ║  edit_intent_hash binds to one specific {action:'delete', answer_id}, ║
 * ║  so the LEFT delete cannot reuse the RIGHT delete's token.            ║
 * ║                                                                        ║
 * ║  EDIT PAIR TEXT:                                                       ║
 * ║    PATCH on the affected answer; destructive (translation.title       ║
 * ║    change → D-11). Triggers force_confirm flow if open attempts.       ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * Inputs are debounced via onBlur (immediate save). The user explicitly tabs
 * away or clicks elsewhere to commit a text change — avoids one PATCH per
 * keystroke and one audit row per keystroke (T-06-46 acceptance).
 */
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
            // Step 1: create LEFT — parent_id null.
            const leftRes = await upsertAnswer(quizId, questionId, {
                question_id: questionId,
                parent_id: null,
                correct: true,
                image: null,
                translations: [
                    { locale: 'ru', title: ' ' },
                    { locale: 'kz', title: ' ' },
                ],
            });
            // Step 2: create RIGHT — parent_id = LEFT.id.
            await upsertAnswer(quizId, questionId, {
                question_id: questionId,
                parent_id: leftRes.answer.id,
                correct: true,
                image: null,
                translations: [
                    { locale: 'ru', title: ' ' },
                    { locale: 'kz', title: ' ' },
                ],
            });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            toast.success(t('saved'));
        } catch (err) {
            // Add-answer is non-destructive — never expects 409 per D-11.
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

    const [leftRu, setLeftRu] = useState(
        pair.left.translations.find((x) => x.locale === 'ru')?.title ?? '',
    );
    const [leftKz, setLeftKz] = useState(
        pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '',
    );
    const [rightRu, setRightRu] = useState(
        pair.right?.translations.find((x) => x.locale === 'ru')?.title ?? '',
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
        setLeftRu(pair.left.translations.find((x) => x.locale === 'ru')?.title ?? '');
        setLeftKz(pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '');
        setRightRu(pair.right?.translations.find((x) => x.locale === 'ru')?.title ?? '');
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
        translations: [
            { locale: 'ru', title: leftRu.length > 0 ? leftRu : ' ' },
            { locale: 'kz', title: leftKz.length > 0 ? leftKz : ' ' },
        ],
    });

    const buildRight = (): UpsertAnswer | null => {
        if (!pair.right) return null;
        return {
            id: pair.right.id,
            question_id: questionId,
            parent_id: pair.left.id,
            correct: pair.right.correct,
            image: pair.right.image ?? null,
            translations: [
                { locale: 'ru', title: rightRu.length > 0 ? rightRu : ' ' },
                { locale: 'kz', title: rightKz.length > 0 ? rightKz : ' ' },
            ],
        };
    };

    const onLeftBlur = () => {
        const ruDirty =
            leftRu !== (pair.left.translations.find((x) => x.locale === 'ru')?.title ?? '');
        const kzDirty =
            leftKz !== (pair.left.translations.find((x) => x.locale === 'kz')?.title ?? '');
        if (!ruDirty && !kzDirty) return;
        if (!leftRu.trim() || !leftKz.trim()) return;
        submit('left', buildLeft());
    };

    const onRightBlur = async () => {
        if (!pair.right) {
            // Orphan LEFT — create the missing RIGHT lazily once user types.
            if (!rightRu.trim() || !rightKz.trim()) return;
            setPending(true);
            try {
                await upsertAnswer(quizId, questionId, {
                    question_id: questionId,
                    parent_id: pair.left.id,
                    correct: true,
                    image: null,
                    translations: [
                        { locale: 'ru', title: rightRu },
                        { locale: 'kz', title: rightKz },
                    ],
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
        const ruDirty =
            rightRu !== (pair.right.translations.find((x) => x.locale === 'ru')?.title ?? '');
        const kzDirty =
            rightKz !== (pair.right.translations.find((x) => x.locale === 'kz')?.title ?? '');
        if (!ruDirty && !kzDirty) return;
        const payload = buildRight();
        if (!payload) return;
        submit('right', payload);
    };

    /**
     * Remove pair — TWO sequential deletes (RIGHT, then LEFT). Each can 409.
     * After RIGHT succeeds (with or without force_confirm), invoke LEFT;
     * if LEFT 409s, open a fresh dialog with a new token.
     */
    const handleRemovePair = async () => {
        if (!window.confirm(t('delete_answer_confirm'))) return;
        setPending(true);
        try {
            // Step 1: DELETE RIGHT (if exists).
            if (pair.right) {
                try {
                    await deleteAnswer(quizId, questionId, pair.right.id);
                } catch (err) {
                    if (err instanceof ForceConfirmRequiredError) {
                        // Park: dialog will run delete with token, then continue to LEFT.
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
            // Step 2: DELETE LEFT.
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
                // Apply the parked delete with the token.
                await deleteAnswer(quizId, questionId, pendingDelete.answerId, pendingToken);
                if (!pendingDelete.afterRightDelete && pair.right?.id === pendingDelete.answerId) {
                    // RIGHT done; now try LEFT (may 409 again with fresh token).
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
                            {t('ru_translation')}
                        </Label>
                        <Input
                            value={leftRu}
                            onChange={(e) => setLeftRu(e.target.value)}
                            onBlur={onLeftBlur}
                            placeholder={t('identificative_left_placeholder')}
                            disabled={pending}
                        />
                    </div>
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
                            {t('ru_translation')}
                        </Label>
                        <Input
                            value={rightRu}
                            onChange={(e) => setRightRu(e.target.value)}
                            onBlur={onRightBlur}
                            placeholder={t('identificative_right_placeholder')}
                            disabled={pending}
                        />
                    </div>
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
