'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { Locale, TranslationCompleteness } from '@/lib/courses/types';

export interface TranslationCompletenessBadgeProps {
    completeness: TranslationCompleteness;
    missingLocales: Locale[];
}

/**
 * CRS-02 — translation-completeness badge (per-row + reused on Plan 03 detail header).
 *
 * 'complete'   -> green/default Badge with ✓ + admin.courses.translation_complete
 * 'incomplete' -> amber/secondary Badge with ⚠ + comma-separated missing locale labels
 *                 (admin.courses.missing_ru / admin.courses.missing_kz)
 *
 * Reused by Plan 03 (course-detail page header) — keep the API stable.
 */
export function TranslationCompletenessBadge({
    completeness,
    missingLocales,
}: TranslationCompletenessBadgeProps) {
    const t = useTranslations('admin.courses');

    if (completeness === 'complete') {
        return (
            <Badge variant='default' className='gap-1'>
                <span aria-hidden>✓</span>
                <span>{t('translation_complete')}</span>
            </Badge>
        );
    }

    const labels = missingLocales.map((l) => (l === 'ru' ? t('missing_ru') : t('missing_kz')));
    return (
        <Badge variant='secondary' className='gap-1'>
            <span aria-hidden>⚠</span>
            <span>{labels.length > 0 ? labels.join(', ') : t('translation_incomplete')}</span>
        </Badge>
    );
}
