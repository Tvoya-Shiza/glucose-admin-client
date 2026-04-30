'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Schedule tab — placeholder per CONTEXT D-05.
 *
 * Phase 5 will replace this body with the WebinarChapterSchedule editor (per-group
 * course scheduling). The translation key `admin.groups.schedule_placeholder` was
 * added in Plan 01 specifically so this slot can render localized copy without a
 * follow-up i18n addendum.
 */
export function ScheduleTab() {
    const t = useTranslations('admin.groups');
    return (
        <div className='pt-4'>
            <Alert>
                <AlertTitle>{t('schedule_tab')}</AlertTitle>
                <AlertDescription>{t('schedule_placeholder')}</AlertDescription>
            </Alert>
        </div>
    );
}
