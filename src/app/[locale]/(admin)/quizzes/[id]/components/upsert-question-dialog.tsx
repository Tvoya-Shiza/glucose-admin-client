'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ForceConfirmRequiredError, upsertQuestion } from '@/lib/quizzes/api';
import type {
    QuestionDetail,
    QuizQuestionType,
    UpsertQuestion,
} from '@/lib/quizzes/types';
import { TiptapEditor } from '../../../courses/[id]/components/tiptap-editor';
import { AnswersEditor } from './answers-editor';
import { ForceConfirmDialog } from './force-confirm-dialog';
import { IdentificativePairsEditor } from './identificative-pairs-editor';
import { QuestionImageUploader } from './question-image-uploader';

/**
 * UpsertQuestionDialog — THE LYNCHPIN UI of Phase 6 Plan 05.
 *
 * Edit-or-create dialog with discriminated form by `type`:
 *   - single | multiple → AnswersEditor (correct-checkbox per row)
 *   - descriptive       → no answers section; correct text lives on
 *                         translations[locale].correct (textarea)
 *   - identificative    → IdentificativePairsEditor (LEFT/RIGHT pairs)
 *
 * Tiptap reuse — DIRECT IMPORT path:
 *   `../../../courses/[id]/components/tiptap-editor`
 * No extraction to a shared location was needed — Phase 5's TiptapEditor +
 * TiptapToolbar are fully self-contained client components with no
 * courses-specific coupling. The relative path is verbose but transparent;
 * extracting later is a search-and-replace if/when a third consumer lands.
 *
 * Force-confirm flow lives at the Save button:
 *   1. User clicks Save → upsertQuestion(payload).
 *   2. On 409 ForceConfirmRequiredError, capture token + open ForceConfirmDialog.
 *   3. On confirm → re-call upsertQuestion(payload + force_confirm_token).
 *      The retry MUST use the EXACT same payload (any drift breaks
 *      edit_intent_hash and 401s with 'force_confirm.payload_changed').
 *
 * Note: answers and pairs are persisted via SEPARATE upsertAnswer calls in
 * AnswersEditor / IdentificativePairsEditor. The Save button here only
 * persists the QUESTION row (type, grade, image, video, translations).
 */
export interface UpsertQuestionDialogProps {
    quizId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When present, dialog is in edit mode. */
    question?: QuestionDetail | null;
}

const QUESTION_TYPES: QuizQuestionType[] = ['single', 'multiple', 'descriptive', 'identificative'];

export function UpsertQuestionDialog({
    quizId,
    open,
    onOpenChange,
    question,
}: UpsertQuestionDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const isEdit = !!question;

    const [type, setType] = useState<QuizQuestionType>(question?.type ?? 'single');
    const [grade, setGrade] = useState<string>(String(question?.grade ?? 1));
    const [imageUrl, setImageUrl] = useState<string | null>(question?.image ?? null);
    const [videoUrl, setVideoUrl] = useState<string>(question?.video ?? '');
    const [answerVideoUrl, setAnswerVideoUrl] = useState<string>(question?.answer_video_url ?? '');

    const [kzTitle, setKzTitle] = useState<string>(
        question?.translations.find((tr) => tr.locale === 'kz')?.title ?? '',
    );
    const [kzDescription, setKzDescription] = useState<string>(
        question?.translations.find((tr) => tr.locale === 'kz')?.description ?? '',
    );
    const [kzCorrect, setKzCorrect] = useState<string>(
        question?.translations.find((tr) => tr.locale === 'kz')?.correct ?? '',
    );

    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingPayload, setPendingPayload] = useState<UpsertQuestion | null>(null);
    const [pendingToken, setPendingToken] = useState<string | null>(null);

    // Reset state on open / different question.
    useEffect(() => {
        if (!open) return;
        setType(question?.type ?? 'single');
        setGrade(String(question?.grade ?? 1));
        setImageUrl(question?.image ?? null);
        setVideoUrl(question?.video ?? '');
        setAnswerVideoUrl(question?.answer_video_url ?? '');
        setKzTitle(question?.translations.find((tr) => tr.locale === 'kz')?.title ?? '');
        setKzDescription(question?.translations.find((tr) => tr.locale === 'kz')?.description ?? '');
        setKzCorrect(question?.translations.find((tr) => tr.locale === 'kz')?.correct ?? '');
        setForceDialogOpen(false);
        setPendingPayload(null);
        setPendingToken(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, question?.id]);

    const buildPayload = (): UpsertQuestion | null => {
        const gradeNum = Number(grade);
        if (!Number.isFinite(gradeNum) || gradeNum < 1) {
            toast.error(t('validation_failed'));
            return null;
        }
        if (!kzTitle.trim()) {
            toast.error(t('validation_failed'));
            return null;
        }
        return {
            id: question?.id,
            grade: gradeNum,
            type,
            image: imageUrl ?? null,
            video: videoUrl.trim().length > 0 ? videoUrl.trim() : null,
            answer_video_url: answerVideoUrl.trim().length > 0 ? answerVideoUrl.trim() : null,
            translations: [
                {
                    locale: 'kz',
                    title: kzTitle,
                    description: kzDescription,
                    correct: type === 'descriptive' ? kzCorrect : null,
                },
            ],
        };
    };

    const mutation = useMutation({
        mutationFn: (payload: UpsertQuestion) => upsertQuestion(quizId, payload),
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            onOpenChange(false);
        },
    });

    const handleSave = async () => {
        const payload = buildPayload();
        if (!payload) return;
        try {
            await mutation.mutateAsync(payload);
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload(payload);
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        }
    };

    const handleForceConfirm = async () => {
        if (!pendingPayload || !pendingToken) return;
        try {
            await mutation.mutateAsync({
                ...pendingPayload,
                force_confirm_token: pendingToken,
            });
            setForceDialogOpen(false);
            setPendingPayload(null);
            setPendingToken(null);
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
        }
    };

    const answersForChild = useMemo(() => question?.answers ?? [], [question?.answers]);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? t('edit_question_dialog_title') : t('create_question_dialog_title')}
                        </DialogTitle>
                        <DialogDescription>{t('question_type_label')}</DialogDescription>
                    </DialogHeader>

                    <div className='space-y-4'>
                        {/* Top row: type + grade */}
                        <div className='grid grid-cols-2 gap-3'>
                            <div className='space-y-1.5'>
                                <Label>{t('question_type_label')}</Label>
                                <Select
                                    value={type}
                                    onValueChange={(v) => setType(v as QuizQuestionType)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {QUESTION_TYPES.map((qt) => (
                                            <SelectItem key={qt} value={qt}>
                                                {t(`q_type_${qt}` as 'q_type_single')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className='space-y-1.5'>
                                <Label>{t('q_grade_label')}</Label>
                                <Input
                                    type='number'
                                    min={1}
                                    value={grade}
                                    onChange={(e) => setGrade(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Image uploader (question-level, optional) */}
                        <div className='space-y-1.5'>
                            <Label>{t('q_image_label')}</Label>
                            <QuestionImageUploader
                                currentImageUrl={imageUrl}
                                onUploaded={(url) => setImageUrl(url)}
                                onClear={() => setImageUrl(null)}
                            />
                        </div>

                        {/* Video URL fields (free-text URLs, no upload widget for v1) */}
                        <div className='grid grid-cols-2 gap-3'>
                            <div className='space-y-1.5'>
                                <Label>{t('q_video_label')}</Label>
                                <Input
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder='https://…'
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <Label>{t('q_answer_video_url_label')}</Label>
                                <Input
                                    value={answerVideoUrl}
                                    onChange={(e) => setAnswerVideoUrl(e.target.value)}
                                    placeholder='https://…'
                                />
                            </div>
                        </div>

                        <div className='space-y-3'>
                            <div className='space-y-1.5'>
                                <Label>{t('q_title_label')}</Label>
                                <Input
                                    value={kzTitle}
                                    onChange={(e) => setKzTitle(e.target.value)}
                                    placeholder={t('q_title_placeholder')}
                                    maxLength={2000}
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <Label>{t('q_description_label')}</Label>
                                <TiptapEditor
                                    initialHtml={kzDescription}
                                    onChange={setKzDescription}
                                />
                            </div>
                            {type === 'descriptive' ? (
                                <div className='space-y-1.5'>
                                    <Label>{t('descriptive_correct_label')}</Label>
                                    <Textarea
                                        value={kzCorrect}
                                        onChange={(e) => setKzCorrect(e.target.value)}
                                        placeholder={t('descriptive_correct_placeholder')}
                                        rows={3}
                                        maxLength={5000}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Answers section — gated by type, only shown in edit mode (need question.id) */}
                        {isEdit && question ? (
                            <div className='border-t pt-3'>
                                {(type === 'single' || type === 'multiple') && (
                                    <AnswersEditor
                                        quizId={quizId}
                                        questionId={question.id}
                                        questionType={type}
                                        answers={answersForChild}
                                    />
                                )}
                                {type === 'identificative' && (
                                    <IdentificativePairsEditor
                                        quizId={quizId}
                                        questionId={question.id}
                                        answers={answersForChild}
                                    />
                                )}
                                {type === 'descriptive' && (
                                    <p className='text-muted-foreground text-xs'>
                                        {t('descriptive_correct_label')} —{' '}
                                        {t('q_description_label')}
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => onOpenChange(false)}
                            disabled={mutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            onClick={handleSave}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? t('saving_dot') : t('save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={(o) => {
                    setForceDialogOpen(o);
                    if (!o) {
                        setPendingPayload(null);
                        setPendingToken(null);
                    }
                }}
                openAttemptsCount={forceCount}
                onConfirm={handleForceConfirm}
                isPending={mutation.isPending}
            />
        </>
    );
}
