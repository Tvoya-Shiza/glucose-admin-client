'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Schedule tab — placeholder per CONTEXT D-05.
 *
 * Plan 06 will replace this body with the per-group WebinarChapterSchedule editor.
 * The translation key `admin.courses.schedule_tab_placeholder_plan_06` is added in
 * Plan 03 specifically so this slot can render localized copy without a follow-up
 * i18n addendum.
 */
export function ScheduleTab() {
    const t = useTranslations('admin.courses');
    return (
        <div className='pt-4'>
            <Alert>
                <AlertTitle>{t('schedule_tab')}</AlertTitle>
                <AlertDescription>{t('schedule_tab_placeholder_plan_06')}</AlertDescription>
            </Alert>
        </div>
    );
}
