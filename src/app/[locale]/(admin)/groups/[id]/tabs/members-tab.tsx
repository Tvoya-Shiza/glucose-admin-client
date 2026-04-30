'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * GRP-03 placeholder — Members tab.
 *
 * Plan 04 will replace this body with the paginated member-list table (D-06 columns:
 * name, email, role, joined_at, last_activity, course-progress summary) plus bulk
 * add/remove via <BulkAddMembersSheet>.
 *
 * For Plan 03 (Wave 3) we ship this honest placeholder so the 3-tab layout is complete
 * and the URL `?tab=members` route is reachable. The component takes `groupId` so
 * Plan 04 can drop in the real implementation without touching the parent client.
 */
export function MembersTab({ groupId }: { groupId: number }) {
    const t = useTranslations('admin.groups');
    return (
        <div className='pt-4'>
            <Alert>
                <AlertTitle>{t('members_tab')}</AlertTitle>
                <AlertDescription>
                    {t('members_tab_placeholder')}
                    {' '}
                    <span className='text-xs opacity-50'>(group #{groupId})</span>
                </AlertDescription>
            </Alert>
        </div>
    );
}
