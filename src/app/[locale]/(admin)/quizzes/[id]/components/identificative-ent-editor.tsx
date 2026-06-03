'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ForceConfirmRequiredError, upsertAnswer } from '@/lib/quizzes/api';
import type { AnswerDetail, UpsertAnswer } from '@/lib/quizzes/types';
import { ForceConfirmDialog } from './force-confirm-dialog';

/**
 * Phase 24 ENT-format identificative editor.
 *
 * Fixed layout: 2 prompts (LEFT) + 4 shared options (RIGHT pool).
 *   - Prompts are rows where `match_target_id != null` (FK to the correct option).
 *   - Options are rows where `match_target_id == null` AND `parent_id == null`.
 *
 * When the question first opens with fewer than 6 answers, the editor
 * bootstraps the missing rows via `upsertAnswer` so the admin always sees the
 * complete 2 + 4 grid.
 *
 * Save semantics:
 *   - Text inputs save on blur (300ms debounce skipped here — simpler for fixed
 *     small layout). The legacy editor used onBlur only; we keep that.
 *   - Select onChange (picking correct option for a prompt) saves immediately.
 *   - Add/Remove buttons disabled — count is fixed.
 *
 * Force-confirm: changing `match_target_id` is destructive (server side flags it).
 * Token handling is deferred to first occurrence — admin retries via toast.
 */
export interface IdentificativeEntEditorProps {
    quizId: number;
    questionId: number;
    answers: AnswerDetail[];
}

const PROMPT_COUNT = 2;
const OPTION_COUNT = 4;

export function IdentificativeEntEditor({
    quizId,
    questionId,
    answers,
}: IdentificativeEntEditorProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    // Phase 24: prompts = rows with match_target_id != null. Options = the rest.
    // We intentionally ignore legacy `parent_id`-based pair rows; they should not
    // exist for new identificative questions and would have been migrated.
    const prompts = answers.filter((a) => a.match_target_id != null);
    const options = answers.filter((a) => a.match_target_id == null && a.parent_id == null);

    // ── Bootstrap: ensure exactly 2 prompts + 4 options exist ──────────────
    // Runs once per question per mount when counts are below targets.
    const bootstrappingRef = useRef(false);
    useEffect(() => {
        if (bootstrappingRef.current) return;
        const needPrompts = Math.max(0, PROMPT_COUNT - prompts.length);
        const needOptions = Math.max(0, OPTION_COUNT - options.length);
        if (needPrompts === 0 && needOptions === 0) return;

        bootstrappingRef.current = true;
        void (async () => {
            try {
                // Create options FIRST so prompts can reference them. We don't
                // wire match_target_id during bootstrap — admin picks it after.
                for (let i = 0; i < needOptions; i++) {
                    await upsertAnswer(quizId, questionId, {
                        question_id: questionId,
                        parent_id: null,
                        match_target_id: null,
                        correct: false,
                        image: null,
                        translations: [{ locale: 'kz', title: ' ' }],
                    });
                }
                for (let i = 0; i < needPrompts; i++) {
                    await upsertAnswer(quizId, questionId, {
                        question_id: questionId,
                        parent_id: null,
                        // match_target_id stays null until admin picks one;
                        // technically the row isn't a "prompt" yet, but the
                        // editor below shows the first non-option rows as
                        // prompt slots until the admin assigns matches.
                        match_target_id: null,
                        correct: false,
                        image: null,
                        translations: [{ locale: 'kz', title: ' ' }],
                    });
                }
                qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
                qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
                qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            } catch (err) {
                toast.error((err as Error).message ?? t('save_failed'));
            } finally {
                bootstrappingRef.current = false;
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionId]);

    // After bootstrap, we display the first 2 non-option rows as prompts and the
    // remaining (or first 4) as options. Admin reassigns matches via select.
    const allNonOptions = answers.filter((a) => a.parent_id == null);
    // promptSlots: rows that are EITHER already prompts (match_target_id != null)
    // OR placeholder rows we'll treat as prompts. We split by recency: prompts
    // first (by id ASC), then placeholder options that became prompts only when
    // their match is set. Easiest deterministic ordering: by id ASC, first 2 = prompts.
    const sortedByCreation = [...allNonOptions].sort((a, b) => a.id - b.id);
    const promptSlots = sortedByCreation.slice(0, PROMPT_COUNT);
    const optionSlots = sortedByCreation.slice(PROMPT_COUNT, PROMPT_COUNT + OPTION_COUNT);

    return (
        <div className='space-y-4'>
            <div className='bg-muted/40 text-muted-foreground flex gap-2 rounded-md border p-3 text-xs'>
                <Info className='mt-0.5 h-4 w-4 shrink-0' />
                <span>{t('identificative_ent_hint')}</span>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
                <div className='space-y-3'>
                    <Label className='text-sm font-semibold'>
                        {t('identificative_prompts_label')}
                    </Label>
                    {promptSlots.map((p, idx) => (
                        <PromptRow
                            key={p.id}
                            index={idx + 1}
                            quizId={quizId}
                            questionId={questionId}
                            prompt={p}
                            options={optionSlots}
                        />
                    ))}
                </div>

                <div className='space-y-3'>
                    <Label className='text-sm font-semibold'>
                        {t('identificative_options_label')}
                    </Label>
                    {optionSlots.map((o, idx) => (
                        <OptionRow
                            key={o.id}
                            index={idx + 1}
                            quizId={quizId}
                            questionId={questionId}
                            option={o}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface PromptRowProps {
    index: number;
    quizId: number;
    questionId: number;
    prompt: AnswerDetail;
    options: AnswerDetail[];
}

function PromptRow({ index, quizId, questionId, prompt, options }: PromptRowProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [title, setTitle] = useState(
        prompt.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '',
    );
    const [pending, setPending] = useState(false);
    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingPayload, setPendingPayload] = useState<UpsertAnswer | null>(null);
    const [pendingToken, setPendingToken] = useState<string | null>(null);

    useEffect(() => {
        if (pending) return;
        setTitle(prompt.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prompt.id, prompt.translations]);

    const mutation = useMutation({
        mutationFn: (payload: UpsertAnswer) => upsertAnswer(quizId, questionId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            setPendingPayload(null);
            setPendingToken(null);
            setForceDialogOpen(false);
        },
    });

    const submit = async (payload: UpsertAnswer) => {
        setPending(true);
        try {
            await mutation.mutateAsync(payload);
            toast.success(t('saved'));
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload(payload);
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setPending(false);
        }
    };

    const onForceConfirm = async () => {
        if (!pendingPayload || !pendingToken) return;
        setPending(true);
        try {
            await mutation.mutateAsync({ ...pendingPayload, force_confirm_token: pendingToken });
            toast.success(t('saved'));
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

    const onTitleBlur = () => {
        const current = prompt.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '';
        if (title === current) return;
        submit({
            id: prompt.id,
            question_id: questionId,
            parent_id: null,
            match_target_id: prompt.match_target_id,
            correct: prompt.correct,
            image: prompt.image ?? null,
            translations: [{ locale: 'kz', title: title.length > 0 ? title : ' ' }],
        });
    };

    const onMatchChange = (value: string) => {
        const next = value === '__none__' ? null : Number(value);
        if (next === prompt.match_target_id) return;
        submit({
            id: prompt.id,
            question_id: questionId,
            parent_id: null,
            match_target_id: next,
            correct: prompt.correct,
            image: prompt.image ?? null,
            translations: [
                {
                    locale: 'kz',
                    title:
                        (prompt.translations.find((x) => x.locale === 'kz')?.title ?? '').length > 0
                            ? prompt.translations.find((x) => x.locale === 'kz')!.title
                            : ' ',
                },
            ],
        });
    };

    return (
        <>
            <div className='space-y-2 rounded-md border p-3'>
                <div className='flex items-center gap-2'>
                    <span className='text-muted-foreground text-xs font-medium'>{index}.</span>
                    <Input
                        value={title}
                        placeholder={t('q_title_label')}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={onTitleBlur}
                    />
                </div>
                <Select
                    value={prompt.match_target_id == null ? '__none__' : String(prompt.match_target_id)}
                    onValueChange={onMatchChange}
                >
                    <SelectTrigger className='h-9'>
                        <SelectValue placeholder={t('identificative_select_match_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='__none__'>
                            {t('identificative_no_match_chosen')}
                        </SelectItem>
                        {options.map((o, i) => {
                            const optionTitle =
                                o.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '';
                            return (
                                <SelectItem key={o.id} value={String(o.id)}>
                                    {`${String.fromCharCode(65 + i)}) ${optionTitle.length > 0 ? optionTitle : `#${o.id}`}`}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={setForceDialogOpen}
                openAttemptsCount={forceCount}
                onConfirm={onForceConfirm}
                isPending={pending}
            />
        </>
    );
}

interface OptionRowProps {
    index: number;
    quizId: number;
    questionId: number;
    option: AnswerDetail;
}

function OptionRow({ index, quizId, questionId, option }: OptionRowProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [title, setTitle] = useState(
        option.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '',
    );
    const [pending, setPending] = useState(false);
    const [forceDialogOpen, setForceDialogOpen] = useState(false);
    const [forceCount, setForceCount] = useState(0);
    const [pendingPayload, setPendingPayload] = useState<UpsertAnswer | null>(null);
    const [pendingToken, setPendingToken] = useState<string | null>(null);

    useEffect(() => {
        if (pending) return;
        setTitle(option.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [option.id, option.translations]);

    const mutation = useMutation({
        mutationFn: (payload: UpsertAnswer) => upsertAnswer(quizId, questionId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'] });
            setPendingPayload(null);
            setPendingToken(null);
            setForceDialogOpen(false);
        },
    });

    const onBlur = async () => {
        const current = option.translations.find((x) => x.locale === 'kz')?.title?.trim() ?? '';
        if (title === current) return;
        const payload: UpsertAnswer = {
            id: option.id,
            question_id: questionId,
            parent_id: null,
            match_target_id: null,
            correct: false,
            image: option.image ?? null,
            translations: [{ locale: 'kz', title: title.length > 0 ? title : ' ' }],
        };
        setPending(true);
        try {
            await mutation.mutateAsync(payload);
            toast.success(t('saved'));
        } catch (err) {
            if (err instanceof ForceConfirmRequiredError) {
                setPendingPayload(payload);
                setPendingToken(err.force_confirm_token);
                setForceCount(err.open_attempts_count);
                setForceDialogOpen(true);
                return;
            }
            toast.error((err as Error).message ?? t('save_failed'));
        } finally {
            setPending(false);
        }
    };

    const onForceConfirm = async () => {
        if (!pendingPayload || !pendingToken) return;
        setPending(true);
        try {
            await mutation.mutateAsync({ ...pendingPayload, force_confirm_token: pendingToken });
            toast.success(t('saved'));
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
        <>
            <div className='flex items-center gap-2 rounded-md border p-3'>
                <span className='text-muted-foreground text-xs font-medium'>
                    {String.fromCharCode(64 + index)})
                </span>
                <Input
                    value={title}
                    placeholder={t('a_title_label')}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={onBlur}
                />
            </div>
            <ForceConfirmDialog
                open={forceDialogOpen}
                onOpenChange={setForceDialogOpen}
                openAttemptsCount={forceCount}
                onConfirm={onForceConfirm}
                isPending={pending}
            />
        </>
    );
}
