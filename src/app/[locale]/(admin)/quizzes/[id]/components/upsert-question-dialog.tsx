'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { MathInput } from '@/components/ui/math-input';
import {
    ForceConfirmRequiredError,
    getQuizPassage,
    listQuestions,
    listQuizPassages,
    listQuizTopics,
    upsertQuestion,
} from '@/lib/quizzes/api';
import {
    TOPIC_NONE,
    childTopicsOf,
    resolveTopicId,
    rootTopicsOf,
    seedTopicSelection,
} from '@/lib/quizzes/topic-selection';

/** «Без контекста». Пустая строка в Radix Select значением быть не может. */
const PASSAGE_NONE = '__none__';
import type {
    QuestionDetail,
    QuizQuestionType,
    UpsertQuestion,
} from '@/lib/quizzes/types';
import { TiptapEditor } from '../../../courses/[id]/components/tiptap-editor';
import { AnswersEditor } from './answers-editor';
import { ForceConfirmDialog } from './force-confirm-dialog';
import { IdentificativeEntEditor } from './identificative-ent-editor';
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
    /** Ограничить выбор типов (тренажёр — только single/multiple). */
    allowedTypes?: QuizQuestionType[];
}

const QUESTION_TYPES: QuizQuestionType[] = ['single', 'multiple', 'descriptive', 'identificative'];

/**
 * Тренажёр умеет прогонять только single/multiple (ТЗ 5.2.1) — остальные типы
 * сервер молча выбрасывает из раунда и флеш-карт. Поэтому вызывающий может
 * сузить список, чтобы методист не завёл вопрос, который нигде не появится.
 */

export function UpsertQuestionDialog({
    quizId,
    open,
    onOpenChange,
    question,
    allowedTypes,
}: UpsertQuestionDialogProps) {
    const types = allowedTypes ?? QUESTION_TYPES;

    // Справочник тем — один запрос на весь раздел, кэш общий с его страницей.
    const topicsQuery = useQuery({
        queryKey: ['admin.quiz-topics.list'],
        queryFn: () => listQuizTopics(),
        staleTime: 5 * 60 * 1000,
    });
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    // After CREATE we keep the dialog open and switch it to edit mode so the answer
    // editors (which need a real question_id) become available immediately, instead
    // of forcing the admin to reopen the question. `createdQuestion` is the response
    // snapshot; once the live list refetches we prefer its (answer-bearing) row.
    const [createdQuestion, setCreatedQuestion] = useState<QuestionDetail | null>(null);

    // Live questions list — same cache key as the questions tab, so this shares the
    // existing cache (no duplicate fetch) and re-renders the open dialog when answers
    // are added to the just-created question.
    const { data: qData } = useQuery({
        queryKey: ['admin.quizzes.questions', quizId],
        queryFn: () => listQuestions(quizId),
        enabled: open,
    });

    const effectiveQuestion: QuestionDetail | null =
        question ??
        (createdQuestion ? qData?.rows.find((r) => r.id === createdQuestion.id) ?? createdQuestion : null);
    const isEdit = !!effectiveQuestion;

    const [type, setType] = useState<QuizQuestionType>(question?.type ?? 'single');
    const [grade, setGrade] = useState<string>(String(question?.grade ?? 1));
    // Тема (phase-51): нужна ради разбора результата по темам. Необязательна —
    // все существующие вопросы созданы без неё.
    //
    // Справочник иерархический, поэтому выбор разделён на два поля. В базу
    // уходит ОДИН `topic_id` — самый конкретный из выбранных: подтема, если
    // она указана, иначе родительская тема.
    const [parentTopicId, setParentTopicId] = useState<string>(TOPIC_NONE);
    const [childTopicId, setChildTopicId] = useState<string>(TOPIC_NONE);

    // Контекст (phase-53). Справочник глобальный и может быть большим, поэтому
    // в выпадающем списке лежат только совпадения с поиском — плюс отдельно
    // подтянутый выбранный, иначе он исчезал бы из списка при вводе запроса.
    const [passageId, setPassageId] = useState<string>(PASSAGE_NONE);
    const [passageQuery, setPassageQuery] = useState('');
    const [passageQueryDebounced, setPassageQueryDebounced] = useState('');

    useEffect(() => {
        const id = setTimeout(() => setPassageQueryDebounced(passageQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [passageQuery]);

    const passagesQuery = useQuery({
        queryKey: ['admin.quiz-passages.picker', passageQueryDebounced],
        queryFn: () => listQuizPassages({ q: passageQueryDebounced, per_page: 20 }),
        enabled: open,
    });

    // Выбранный контекст догружаем отдельно: при непустом поиске его может не
    // быть в выдаче, и тогда Select показал бы пустоту вместо привязки.
    const selectedPassageQuery = useQuery({
        queryKey: ['admin.quiz-passages.detail', passageId],
        queryFn: () => getQuizPassage(Number(passageId)),
        enabled: open && passageId !== PASSAGE_NONE,
    });

    const passageOptions = (() => {
        const rows = passagesQuery.data?.passages ?? [];
        const selected = selectedPassageQuery.data;
        if (!selected || rows.some((r) => r.id === selected.id)) return rows;
        return [selected, ...rows];
    })();
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
        setCreatedQuestion(null);
        setType(question?.type ?? 'single');
        setGrade(String(question?.grade ?? 1));
        const seeded = seedTopicSelection(question?.topic_id ?? null, topicsQuery.data ?? []);
        setParentTopicId(seeded.parent);
        setChildTopicId(seeded.child);
        setPassageId(question?.passage_id == null ? PASSAGE_NONE : String(question.passage_id));
        setPassageQuery('');
        setPassageQueryDebounced('');
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
    }, [open, question?.id, topicsQuery.data]);

    const allTopics = topicsQuery.data ?? [];
    const rootTopics = rootTopicsOf(allTopics);
    const childTopics = childTopicsOf(allTopics, parentTopicId);

    /**
     * Смена родительской темы сбрасывает подтему: оставить прежнюю значило бы
     * сохранить вопрос в подтему, которая новому родителю не принадлежит.
     */
    const onParentTopicChange = (next: string) => {
        setParentTopicId(next);
        setChildTopicId(TOPIC_NONE);
    };

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
            id: effectiveQuestion?.id,
            grade: gradeNum,
            topic_id: resolveTopicId(parentTopicId, childTopicId),
            passage_id: passageId === PASSAGE_NONE ? null : Number(passageId),
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
        onSuccess: (data, payload) => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            // Just CREATED an answer-bearing question → stay open in edit mode so the
            // admin can add options now. `descriptive` carries no options, so close it.
            if (payload.id == null && payload.type !== 'descriptive') {
                setCreatedQuestion(data.question);
                toast.success(t('question_saved_add_answers'));
                return;
            }
            toast.success(t('saved'));
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

    const answersForChild = useMemo(() => effectiveQuestion?.answers ?? [], [effectiveQuestion?.answers]);

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
                                        {types.map((qt) => (
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

                        {/* Тема из справочника: по ней собирается разбор результата.
                            Два поля, а не одно: справочник иерархический, и плоский
                            список сваливал «Ботанику» и её подтемы в одну кучу —
                            по нему нельзя было понять, что чему принадлежит.
                            Отдельной строкой от типа и балла: названия тем длинные
                            и в половину ширины не читаются. */}
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <div className='space-y-1.5'>
                                <Label>{t('question_topic_label')}</Label>
                                <Select value={parentTopicId} onValueChange={onParentTopicChange}>
                                    <SelectTrigger className='w-full'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={TOPIC_NONE}>{t('question_topic_none')}</SelectItem>
                                        {rootTopics.map((topic) => (
                                            <SelectItem key={topic.id} value={String(topic.id)}>
                                                {topic.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className='space-y-1.5'>
                                <Label>{t('question_subtopic_label')}</Label>
                                <Select
                                    value={childTopicId}
                                    onValueChange={setChildTopicId}
                                    disabled={childTopics.length === 0}
                                >
                                    <SelectTrigger className='w-full'>
                                        {/* Своя подпись вместо SelectValue: у пустого значения
                                            SelectValue показывает пустоту, а нужно объяснить,
                                            почему поле неактивно. */}
                                        <span className={childTopicId === TOPIC_NONE ? 'text-muted-foreground' : ''}>
                                            {childTopicId === TOPIC_NONE
                                                ? parentTopicId === TOPIC_NONE
                                                    ? t('question_subtopic_pick_parent')
                                                    : childTopics.length === 0
                                                      ? t('question_subtopic_none_available')
                                                      : t('question_subtopic_all')
                                                : (childTopics.find((x) => String(x.id) === childTopicId)?.name ?? '')}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {/* «Вся тема целиком» — вопрос относится к родителю,
                                            а не к какой-то одной подтеме. */}
                                        <SelectItem value={TOPIC_NONE}>{t('question_subtopic_all')}</SelectItem>
                                        {childTopics.map((topic) => (
                                            <SelectItem key={topic.id} value={String(topic.id)}>
                                                {topic.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Контекст (phase-53) — стимульный текст над вопросом.
                            Справочник глобальный и может быть большим, поэтому
                            рядом стоит поиск по названию: список показывает
                            совпадения, а не весь справочник целиком. */}
                        <div className='space-y-1.5'>
                            <Label>{t('question_passage_label')}</Label>
                            <Input
                                value={passageQuery}
                                onChange={(e) => setPassageQuery(e.target.value)}
                                placeholder={t('question_passage_search')}
                                maxLength={255}
                            />
                            <Select value={passageId} onValueChange={setPassageId}>
                                <SelectTrigger className='w-full'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={PASSAGE_NONE}>{t('question_passage_none')}</SelectItem>
                                    {passageOptions.map((row) => (
                                        <SelectItem key={row.id} value={String(row.id)}>
                                            {row.title || t('passage_untitled')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                <MathInput
                                    value={kzTitle}
                                    onChange={setKzTitle}
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
                                    <MathInput
                                        multiline
                                        value={kzCorrect}
                                        onChange={setKzCorrect}
                                        placeholder={t('descriptive_correct_placeholder')}
                                        rows={3}
                                        maxLength={5000}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {/* Answers section — gated by type, shown once a question_id exists
                            (edit mode, or right after create when the dialog stays open). */}
                        {effectiveQuestion ? (
                            <div className='border-t pt-3'>
                                {(type === 'single' || type === 'multiple') && (
                                    <AnswersEditor
                                        quizId={quizId}
                                        questionId={effectiveQuestion.id}
                                        questionType={type}
                                        answers={answersForChild}
                                    />
                                )}
                                {type === 'identificative' && (
                                    <IdentificativeEntEditor
                                        quizId={quizId}
                                        questionId={effectiveQuestion.id}
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
                            {createdQuestion ? t('done') : t('cancel')}
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
