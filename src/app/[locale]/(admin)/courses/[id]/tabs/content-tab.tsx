'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Content tab — placeholder per CONTEXT D-05 / D-07.
 *
 * Plan 05 will replace this body with the chapter/item tree editor (dnd-kit drag-drop
 * + Tiptap rich-text). The translation key `admin.courses.content_tab_placeholder_plan_05`
 * is added in Plan 03 specifically so this slot can render localized copy without a
 * follow-up i18n addendum.
 */
export function ContentTab() {
    const t = useTranslations('admin.courses');
    return (
        <div className='pt-4'>
            <Alert>
                <AlertTitle>{t('content_tab')}</AlertTitle>
                <AlertDescription>{t('content_tab_placeholder_plan_05')}</AlertDescription>
            </Alert>
        </div>
    );
}
