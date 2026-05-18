'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCategories, updateQuiz } from '@/lib/quizzes/api';
import { usePermission } from '@/lib/access/use-permission';
import type { QuizDetail, QuizStatus, Translation, UpdateQuiz } from '@/lib/quizzes/types';
import { QuizTranslationForm } from '../components/translation-form';

export interface OverviewTabProps {
    quiz: QuizDetail;
    role: 'admin' | 'curator' | 'teacher';
}

/**
 * QZ-01 — Quiz detail Overview tab (Plan 04 — REAL implementation).
 *
 * Layout (top to bottom, per plan body):
 *   1. Two-column grid: side-by-side RU + KZ <QuizTranslationForm> with debounced
 *      inline saves (300ms; per plan).
 *   2. Field grid: status select / category select / time-limit / attempt /
 *      pass_mark / certificate / display_questions_randomly / expiry_days.
 *      Selects + checkboxes save IMMEDIATELY on change. Number / text fields save
 *      on blur OR after 300ms of debounced quiet.
 *
 * Mutation invalidations (T-06-46 traceability):
 *   - On every successful PATCH:
 *       qc.setQueryData(['admin.quizzes.detail', quizId], freshDetail)
 *       qc.invalidateQueries(['admin.quizzes.list'])  (badge + version may have changed)
 *   - On error: localized toast; the form's local-state remains so the user can retry.
 *
 * RBAC (D-21):
 *   - admin / teacher: full edit.
 *   - curator: never reach this tab — admin-api 403s the detail fetch
 *     (QuizDetailClient surfaces the 403 Alert before this tab mounts). Defensively,
 *     `disabled={role === 'curator'}` is set on every input as a belt-and-braces
 *     guard against future routing changes.
 *
 * Header-level Duplicate / Delete buttons live in quiz-detail-client.tsx, not here.
 * This mirrors Phase 5 Plan 03 OverviewTab's separation (destructive / cross-cutting
 * actions in the page header; field edits in the tab).
 *
 * Each PATCH triggers @Audit('quizzes.update','quiz') on admin-api (Plan 02). The
 * 300ms debounce ensures 1-edit = 1-save = 1-audit row (T-06-46 acceptance).
 */
export function OverviewTab({ quiz, role }: OverviewTabProps) {
    const t = useTranslations('admin.quizzes');
    const queryClient = useQueryClient();
    const canEdit = usePermission('quizzes.edit');
    const isReadOnly = !canEdit;

    // Categories list (Plan 03) — used by the category select. Fetched once per detail
    // mount; cached by TanStack Query so revisits to the tab don't re-fetch.
    const categoriesQuery = useQuery({
        queryKey: ['admin.quizzes.categories.list'],
        queryFn: () => listCategories(),
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: (payload: UpdateQuiz) => updateQuiz(quiz.id, payload),
        onSuccess: (fresh) => {
            queryClient.setQueryData(['admin.quizzes.detail', quiz.id], fresh);
            void queryClient.invalidateQueries({ queryKey: ['admin.quizzes.list'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    function patch(payload: UpdateQuiz): Promise<unknown> {
        return mutation.mutateAsync(payload);
    }

    // Translation save handlers — one per locale.
    async function saveTranslation(locale: 'kz', title: string) {
        // Server's update path does upsert per (quiz_id, locale) in the existing list;
        // sending a single-locale array is sufficient (Plan 02 mutations service does
        // find-then-update inside $transaction).
        const next: Translation[] = [{ locale, title }];
        await patch({ translations: next });
    }

    const kzTr = quiz.translations.find((tr) => tr.locale === 'kz');

    return (
        <div className='space-y-5 pt-4'>
            {/* KZ translation (CONTEXT D-05). */}
            <QuizTranslationForm
                locale='kz'
                initialTitle={kzTr?.title ?? ''}
                onSave={(v) => saveTranslation('kz', v)}
                disabled={isReadOnly}
            />

            {/* Settings grid */}
            <div className='space-y-4 rounded-lg border p-4'>
                <h3 className='text-sm font-semibold'>{t('overview_tab')}</h3>

                <div className='grid gap-4 md:grid-cols-2'>
                    <FieldRow label={t('status_label')}>
                        <Select
                            value={quiz.status}
                            onValueChange={(v) => patch({ status: v as QuizStatus })}
                            disabled={isReadOnly}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='active'>{t('status_active')}</SelectItem>
                                <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FieldRow>

                    <FieldRow label={t('category_label')}>
                        <Select
                            value={
                                quiz.category && typeof quiz.category.id === 'number'
                                    ? String(quiz.category.id)
                                    : '__none__'
                            }
                            onValueChange={(v) =>
                                patch({ category_id: v === '__none__' ? null : Number(v) })
                            }
                            disabled={isReadOnly || categoriesQuery.isLoading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('filter_all')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='__none__'>{t('filter_all')}</SelectItem>
                                {(categoriesQuery.data ?? []).map((c) => {
                                    const ru =
                                        c.translations.find((tr) => tr.locale === 'kz')?.title ??
                                        `#${c.id}`;
                                    return (
                                        <SelectItem key={c.id} value={String(c.id)}>
                                            {ru}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </FieldRow>

                    <DebouncedNumberField
                        label={t('time_limit_label')}
                        placeholder={t('time_limit_unlimited')}
                        value={quiz.time}
                        onCommit={(n) => patch({ time: n })}
                        disabled={isReadOnly}
                    />

                    <DebouncedNumberField
                        label={t('attempt_label')}
                        placeholder={t('attempt_unlimited')}
                        value={quiz.attempt}
                        onCommit={(n) => patch({ attempt: n })}
                        disabled={isReadOnly}
                    />

                    <DebouncedNumberField
                        label={t('pass_mark_label')}
                        value={quiz.pass_mark}
                        onCommit={(n) => {
                            // pass_mark is REQUIRED on the server (>= 0) — coerce null → 0.
                            patch({ pass_mark: n == null ? 0 : Math.max(0, n) });
                        }}
                        disabled={isReadOnly}
                        nullable={false}
                    />

                    <DebouncedNumberField
                        label={t('expiry_days_label')}
                        value={quiz.expiry_days}
                        onCommit={(n) => patch({ expiry_days: n })}
                        disabled={isReadOnly}
                    />

                    <FieldRow label={t('certificate_label')}>
                        <Checkbox
                            checked={quiz.certificate}
                            onCheckedChange={(v) => patch({ certificate: !!v })}
                            disabled={isReadOnly}
                        />
                    </FieldRow>

                    <FieldRow label={t('randomize_label')}>
                        <Checkbox
                            checked={quiz.display_questions_randomly}
                            onCheckedChange={(v) => patch({ display_questions_randomly: !!v })}
                            disabled={isReadOnly}
                        />
                    </FieldRow>
                </div>
            </div>
        </div>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-1'>
            <Label className='text-xs'>{label}</Label>
            {children}
        </div>
    );
}

/**
 * Debounced numeric input that commits on either:
 *   - blur (immediate)
 *   - 600ms of quiet typing
 *
 * Why 600ms here vs 300ms on translation forms: numeric inputs benefit from a
 * slightly longer window so partial entries like "12" → "120" don't fire two
 * PATCHes; translation typing benefits from snappier feedback.
 *
 * Empty string is interpreted as `null` (cleared / unlimited) when `nullable !== false`.
 */
function DebouncedNumberField({
    label,
    value,
    onCommit,
    placeholder,
    disabled,
    nullable = true,
    debounceMs = 600,
}: {
    label: string;
    value: number | null;
    onCommit: (n: number | null) => void;
    placeholder?: string;
    disabled?: boolean;
    nullable?: boolean;
    debounceMs?: number;
}) {
    const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setDraft(value == null ? '' : String(value));
    }, [value]);

    function commit(raw: string) {
        if (raw.trim().length === 0) {
            if (nullable && value !== null) onCommit(null);
            return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        if (n !== value) onCommit(n);
    }

    return (
        <FieldRow label={label}>
            <Input
                type='number'
                value={draft}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    if (timerRef.current) clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(() => commit(v), debounceMs);
                }}
                onBlur={() => {
                    if (timerRef.current) clearTimeout(timerRef.current);
                    commit(draft);
                }}
            />
        </FieldRow>
    );
}
