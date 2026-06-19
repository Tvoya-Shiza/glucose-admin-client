'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MathInput } from '@/components/ui/math-input';
import {
    deleteAnswer,
    ForceConfirmRequiredError,
    upsertAnswer,
} from '@/lib/quizzes/api';
import type { AnswerDetail, UpsertAnswer } from '@/lib/quizzes/types';
import { AnswerImageUploader } from './answer-image-uploader';
import { ForceConfirmDialog } from './force-confirm-dialog';

/**
 * AnswersEditor — list editor for question types `single` | `multiple` (Plan 05).
 *
 * Each row is a self-contained <AnswerRow> with:
 *   - RU + KZ title inputs (debounced save on blur)
 *   - `correct` checkbox (immediate save)
 *   - image uploader (immediate save on upload)
 *   - delete button (with force-confirm flow)
 *
 * NOTE on reorder: QuizQuestionAnswer schema lacks an `order` column (admin-api
 * orders by id ASC for v1). dnd-kit visual reorder is therefore NOT persisted
 * across reloads — deferred to v2 per Plan 05 deferred-items. The current editor
 * does not surface drag handles to avoid misleading the user.
 *
 * Force-confirm flow:
 *   - Toggle `correct` / change title text / change parent_id → DESTRUCTIVE.
 *   - Delete → DESTRUCTIVE.
 *   - On 409 ForceConfirmRequiredError, the row opens its own ForceConfirmDialog,
 *     which on confirm re-submits the SAME payload + force_confirm_token.
 *     Token's edit_intent_hash binds to that exact payload — caller MUST
 *     preserve the original DTO for retry (we use a closure over `pendingPayload`).
 *
 * - Image swap → NOT destructive. Toggling `correct` IS destructive.
 *   Both are persisted immediately via upsertAnswer (single PATCH per change).
 */
export interface AnswersEditorProps {
    quizId: number;
    questionId: number;
    questionType: 'single' | 'multiple';
    answers: AnswerDetail[];
}

export function AnswersEditor({
    quizId,
    questionId,
    questionType,
    answers,
}: AnswersEditorProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const [adding, setAdding] = useState(false);

    const filtered = answers.filter((a) => a.parent_id == null);

    const handleAdd = async () => {
        setAdding(true);
        try {
            await upsertAnswer(quizId, questionId, {
                question_id: questionId,
                parent_id: null,
                correct: false,
                image: null,
                translations: [{ locale: 'kz', title: ' ' }],
            });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            toast.success(t('saved'));
        } catch (err) {
            // CREATE answer is NOT destructive per D-11 — never expects 409.
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className='space-y-2'>
            <div className='flex items-center justify-between'>
                <Label className='text-sm font-semibold'>
                    {t('answers_count', { count: filtered.length })}
                </Label>
                <Button type='button' size='sm' variant='outline' onClick={handleAdd} disabled={adding}>
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_answer')}
                </Button>
            </div>
            {filtered.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-3 text-center text-sm'>
                    {t('no_answers_yet')}
                </div>
            ) : (
                <div className='space-y-2'>
                    {filtered.map((a) => (
                        <AnswerRow
                            key={a.id}
                            quizId={quizId}
                            questionId={questionId}
                            questionType={questionType}
                            answer={a}
                        />
                    ))}
                </div>
            )}
            <p className='text-muted-foreground text-xs'>{t('answer_reorder_visual_only_hint')}</p>
        </div>
    );
}

interface AnswerRowProps {
    quizId: number;
    questionId: number;
    questionType: 'single' | 'multiple';
    answer: AnswerDetail;
}

function AnswerRow({ quizId, questionId, questionType: _questionType, answer }: AnswerRowProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    // Local state mirrors the server snapshot until a save round-trip lands.
    const [kzTitle, setKzTitle] = useState(
        answer.translations.find((tr) => tr.locale === 'kz')?.title ?? '',
    );
    const [correct, setCorrect] = useState(answer.correct);
    const [imageUrl, setImageUrl] = useState(answer.image);

    // Force-confirm dialog state — preserves the EXACT payload that triggered
    // the 409 so we can retry with the same edit_intent_hash binding.
    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingPayload, setPendingPayload] = useState<UpsertAnswer | null>(null);
    const [pendingToken, setPendingToken] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState(false);
    const [pending, setPending] = useState(false);

    // Re-sync from props after upstream refetch (TanStack Query invalidate) —
    // skip if we're mid-save to avoid clobbering local edits.
    useEffect(() => {
        if (pending) return;
        setKzTitle(answer.translations.find((tr) => tr.locale === 'kz')?.title ?? '');
        setCorrect(answer.correct);
        setImageUrl(answer.image);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answer.id, answer.translations, answer.correct, answer.image]);

    const buildPayload = (overrides: Partial<UpsertAnswer> = {}): UpsertAnswer => ({
        id: answer.id,
        question_id: questionId,
        parent_id: answer.parent_id ?? null,
        correct,
        image: imageUrl ?? null,
        translations: [
            { locale: 'kz', title: kzTitle.length > 0 ? kzTitle : ' ' },
        ],
        ...overrides,
    });

    const updateMutation = useMutation({
        mutationFn: async (payload: UpsertAnswer) => {
            return upsertAnswer(quizId, questionId, payload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            setPendingPayload(null);
            setPendingToken(null);
            setForceDialogOpen(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (token: string | undefined) => {
            return deleteAnswer(quizId, questionId, answer.id, token);
        },
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            setPendingDelete(false);
            setForceDialogOpen(false);
            setPendingToken(null);
        },
    });

    const submit = async (payload: UpsertAnswer) => {
        setPending(true);
        try {
            await updateMutation.mutateAsync(payload);
            toast.success(t('saved'));
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload(payload);
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setPendingDelete(false);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setPending(false);
        }
    };

    const submitDelete = async () => {
        if (!window.confirm(t('delete_answer_confirm'))) return;
        setPending(true);
        try {
            await deleteMutation.mutateAsync(undefined);
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload(null);
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setPendingDelete(true);
                setForceDialogOpen(true);
                return;
            }
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
                await deleteMutation.mutateAsync(pendingToken);
            } else if (pendingPayload) {
                await updateMutation.mutateAsync({
                    ...pendingPayload,
                    force_confirm_token: pendingToken,
                });
                toast.success(t('saved'));
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

    const handleBlurTitle = () => {
        const kzDirty = kzTitle !== (answer.translations.find((x) => x.locale === 'kz')?.title ?? '');
        if (!kzDirty) return;
        if (!kzTitle.trim()) {
            toast.error(t('validation_failed'));
            return;
        }
        submit(buildPayload());
    };

    const handleToggleCorrect = (next: boolean) => {
        setCorrect(next);
        submit(buildPayload({ correct: next }));
    };

    const handleImageUploaded = (url: string) => {
        setImageUrl(url);
        submit(buildPayload({ image: url }));
    };

    const handleImageClear = () => {
        setImageUrl(null);
        submit(buildPayload({ image: null }));
    };

    return (
        <div className='bg-card flex flex-col gap-2 rounded-lg border p-3'>
            <div className='flex items-center gap-3'>
                <Checkbox
                    checked={correct}
                    onCheckedChange={(v) => handleToggleCorrect(!!v)}
                    aria-label={t('a_correct_label')}
                    disabled={pending}
                />
                <span className='text-muted-foreground shrink-0 text-xs'>
                    {t('a_correct_label')}
                </span>
                <div className='ml-auto flex items-center gap-2'>
                    <AnswerImageUploader
                        currentImageUrl={imageUrl}
                        onUploaded={handleImageUploaded}
                        onClear={handleImageClear}
                        disabled={pending}
                    />
                    <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={submitDelete}
                        disabled={pending}
                    >
                        <Trash className='h-4 w-4' />
                    </Button>
                </div>
            </div>
            <div className='grid gap-2'>
                <div className='space-y-1'>
                    <Label className='text-muted-foreground text-xs'>
                        {t('kz_translation')}
                    </Label>
                    <MathInput
                        value={kzTitle}
                        onChange={setKzTitle}
                        onBlur={handleBlurTitle}
                        placeholder={t('answer_title_placeholder')}
                        disabled={pending}
                    />
                </div>
            </div>
            {/* questionType is reserved for future "single" radio-style enforcement;
                today both 'single' and 'multiple' use the same checkbox UI. The
                server enforces single-vs-multiple semantics at grade time. */}
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={(open) => {
                    setForceDialogOpen(open);
                    if (!open) {
                        setPendingPayload(null);
                        setPendingToken(null);
                        setPendingDelete(false);
                    }
                }}
                openAttemptsCount={forceCount}
                onConfirm={onForceConfirm}
                isPending={pending}
            />
        </div>
    );
}
