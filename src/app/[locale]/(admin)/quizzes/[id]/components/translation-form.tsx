'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Locale } from '@/lib/quizzes/types';

/**
 * Quiz-detail Translation form for ONE locale (CRS-equivalent for QZ-01 / D-04 / D-05).
 *
 * Side-by-side RU + KZ rendering is achieved by the OverviewTab placing two of these
 * in a two-column grid. Each instance is self-contained: owns its own debounce,
 * fires `onSave(title)` after `debounceMs` ms of no edits.
 *
 * Diverges from Phase 5 courses translation-form.tsx in two ways:
 *   - Plan 04 quizzes overview uses INLINE / EDIT-IN-PLACE saves rather than a
 *     parent rhf form + Save button. Each field commits on debounced change. This
 *     matches the plan body's "edit-in-place per field" instruction (D-04, D-05).
 *   - Quiz translations are TITLE-ONLY (no description). The component is therefore
 *     simpler than the courses equivalent.
 *
 * Plan 04 ships title-only edit. If/when description-style fields are added to the
 * Quizzes translation surface (plan does not call for it; QuizTranslation.title is
 * the only column), extend this component with a Textarea row in a follow-up.
 */
export interface QuizTranslationFormProps {
    locale: Locale;
    /** Current persisted title (parent feeds this from QuizDetail.translations). */
    initialTitle: string;
    /** Called after debounceMs of no edits with the latest value. */
    onSave: (title: string) => Promise<void> | void;
    /** Disables the input (read-only preview / mutation in flight). */
    disabled?: boolean;
    /** Debounce window in ms. Default 300 (per plan body). */
    debounceMs?: number;
}

export function QuizTranslationForm({
    locale,
    initialTitle,
    onSave,
    disabled,
    debounceMs = 300,
}: QuizTranslationFormProps) {
    const t = useTranslations('admin.quizzes');
    const [value, setValue] = useState(initialTitle);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Re-sync local state if the parent feeds a fresh persisted title (e.g. after
    // refetch). Skip if the user is in the middle of editing — the local value is
    // authoritative until the next save round-trip completes.
    useEffect(() => {
        if (!saving) setValue(initialTitle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTitle]);

    function scheduleSave(next: string) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            if (next === initialTitle) return; // no-op if nothing changed
            setSaving(true);
            try {
                await onSave(next);
                setSavedAt(Date.now());
            } finally {
                setSaving(false);
            }
        }, debounceMs);
    }

    function handleBlur() {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (value === initialTitle) return;
        (async () => {
            setSaving(true);
            try {
                await onSave(value);
                setSavedAt(Date.now());
            } finally {
                setSaving(false);
            }
        })();
    }

    const heading = t('kz_translation');
    const showSaved = savedAt != null && !saving && Date.now() - savedAt < 2500;

    return (
        <div className='space-y-3 rounded-lg border p-4'>
            <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-semibold'>{heading}</h3>
                <span className='text-muted-foreground text-xs' aria-live='polite'>
                    {saving ? t('field_saving') : showSaved ? t('field_saved_inline') : null}
                </span>
            </div>
            <div className='space-y-1'>
                <Label htmlFor={`title-${locale}`}>{t('title_label')}</Label>
                <Input
                    id={`title-${locale}`}
                    value={value}
                    placeholder={t('title_placeholder')}
                    onChange={(e) => {
                        const v = e.target.value;
                        setValue(v);
                        scheduleSave(v);
                    }}
                    onBlur={handleBlur}
                    disabled={disabled || saving}
                    maxLength={255}
                />
            </div>
        </div>
    );
}
