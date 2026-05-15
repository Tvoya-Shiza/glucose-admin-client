'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Locale } from '@/lib/courses/types';

/**
 * Translation form for ONE locale (CRS-02 + CONTEXT D-06).
 *
 * Side-by-side RU + KZ rendering is achieved by the Overview tab placing two of these
 * in a two-column grid. Each instance is a parent-controlled (not RHF-nested) input
 * pair — the parent owns submit orchestration so that "Save" can collect both
 * locales' values and emit a single updateCourse call with `translations: [ru, kz]`.
 *
 * Why parent-controlled state and not nested useFormContext: nesting a child rhf form
 * inside a parent rhf form requires either a custom resolver or two submit handlers.
 * Mirror Phase 4 Plan 03 EditGroupForm's flat shape — one form, all fields. That form
 * has only `name`+`status`; here we have name/status/category/slug PLUS title+description
 * for two locales. Treating the locale forms as controlled inputs keeps the parent
 * EditCourseForm a single rhf instance with everything in `defaultValues`.
 *
 * Validation lives in the parent's zod schema — see edit-course-form.tsx (title 1..255,
 * description optional, max 65535 chars). This component is purely presentational +
 * an event-emitting controlled input pair.
 */
export interface TranslationFormProps {
    locale: Locale;
    title: string;
    description: string;
    onTitleChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    /** Optional zod-derived error messages from the parent form. */
    titleError?: string;
    descriptionError?: string;
    disabled?: boolean;
}

export function TranslationForm({
    locale,
    title,
    description,
    onTitleChange,
    onDescriptionChange,
    titleError,
    descriptionError,
    disabled,
}: TranslationFormProps) {
    const t = useTranslations('admin.courses');
    const heading = t('kz_translation');

    return (
        <div className='space-y-3 rounded-lg border p-4'>
            <h3 className='text-sm font-semibold'>{heading}</h3>
            <div className='space-y-1'>
                <Label htmlFor={`title-${locale}`}>{t('title_label')}</Label>
                <Input
                    id={`title-${locale}`}
                    value={title}
                    placeholder={t('title_placeholder')}
                    onChange={(e) => onTitleChange(e.target.value)}
                    disabled={disabled}
                    maxLength={255}
                />
                {titleError ? <p className='text-destructive text-xs'>{titleError}</p> : null}
            </div>
            <div className='space-y-1'>
                <Label htmlFor={`description-${locale}`}>{t('description_label')}</Label>
                <Textarea
                    id={`description-${locale}`}
                    value={description}
                    placeholder={t('description_placeholder')}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    disabled={disabled}
                    maxLength={65535}
                    rows={5}
                />
                {descriptionError ? (
                    <p className='text-destructive text-xs'>{descriptionError}</p>
                ) : null}
            </div>
        </div>
    );
}
