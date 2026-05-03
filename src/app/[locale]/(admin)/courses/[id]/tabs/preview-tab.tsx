'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Preview tab — placeholder per CONTEXT D-05 / D-20.
 *
 * Plan 07 will replace this body with the read-only "preview as student" mirror render
 * + per-group context dropdown. The translation key
 * `admin.courses.preview_tab_placeholder_plan_07` is added in Plan 03 specifically so
 * this slot can render localized copy without a follow-up i18n addendum.
 */
export function PreviewTab() {
    const t = useTranslations('admin.courses');
    return (
        <div className='pt-4'>
            <Alert>
                <AlertTitle>{t('preview_tab')}</AlertTitle>
                <AlertDescription>{t('preview_tab_placeholder_plan_07')}</AlertDescription>
            </Alert>
        </div>
    );
}
