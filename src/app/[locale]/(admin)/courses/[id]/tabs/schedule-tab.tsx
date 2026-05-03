'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GroupContextPicker } from '../components/group-context-picker';
import { ScheduleListByGroup } from '../components/schedule-list-by-group';

/**
 * Schedule tab — Plan 06 implementation (CRS-08).
 *
 * Replaces the Plan 03 placeholder. Selects a Group via GroupContextPicker (URL state
 * `?schedule_group=<id>` so the selection survives reloads + share-links) and renders
 * ScheduleListByGroup for the chosen group.
 *
 * Why URL state vs local state: it matches the pattern of the Content tab's
 * tab-state and the Phase 4 group-detail-client tab-state — admins frequently
 * share links to "group X's schedule for course Y" with curators / teachers.
 *
 * Curator note: the Schedule tab itself is reachable for curators (controller
 * @Roles is admin/teacher only at the schedules endpoint, but the detail page is
 * admin/curator/teacher). A curator who navigates here will see the group picker;
 * the schedules list will fail with a 403 surface — which is expected per CONTEXT
 * D-19. We could short-circuit at the tab level, but per the broader Phase 5 pattern
 * (server-side scope enforcement is the source of truth), we let the API layer
 * surface the rejection.
 */
export function ScheduleTab({ courseId }: { courseId: number }) {
    const [groupId, setGroupId] = useQueryState('schedule_group', parseAsString);
    const t = useTranslations('admin.courses');

    return (
        <div className='space-y-4 pt-4'>
            <div className='flex items-end justify-between gap-4'>
                <div className='space-y-1'>
                    <h2 className='text-lg font-semibold'>{t('schedule_tab')}</h2>
                    <p className='text-muted-foreground text-sm'>
                        {t('schedule_pick_group_help')}
                    </p>
                </div>
                <GroupContextPicker value={groupId} onChange={(v) => setGroupId(v)} />
            </div>

            {groupId ? (
                <ScheduleListByGroup courseId={courseId} groupId={Number(groupId)} />
            ) : (
                <Alert>
                    <AlertTitle>{t('select_a_group')}</AlertTitle>
                    <AlertDescription>{t('schedule_pick_group_help')}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
