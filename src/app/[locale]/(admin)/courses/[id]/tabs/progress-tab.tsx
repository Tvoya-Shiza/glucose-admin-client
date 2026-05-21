'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressOverridesManager } from '../components/progress-overrides-manager';
import { ProgressReportView } from '../components/progress-report-view';

export interface ProgressTabProps {
    courseId: number;
}

const SUBTABS = ['manage', 'view'] as const;
type SubTabKey = (typeof SUBTABS)[number];

/**
 * Phase 19 / Feature B — outer "Прогресс" tab on /kz/courses/[id].
 *
 * Wraps two sub-tabs (URL state via `?subtab=`):
 *   - 'manage' → ProgressOverridesManager (PR-6, ready). Admin grants/revokes
 *     per-item content unlocks bypassing strict_progress.
 *   - 'view'   → progress report (PR-7, placeholder). Read-only per-target
 *     per-item completion status.
 *
 * Outer tab is lazy-mounted in course-detail-client.tsx so this nested Tabs
 * component does not load until the operator clicks into "Прогресс".
 */
export function ProgressTab({ courseId }: ProgressTabProps) {
    const t = useTranslations('admin.progress_overrides');
    const [subtab, setSubtab] = useQueryState('subtab', parseAsString.withDefault('manage'));
    const safe: SubTabKey = (SUBTABS as readonly string[]).includes(subtab) ? (subtab as SubTabKey) : 'manage';

    return (
        <Tabs value={safe} onValueChange={(v) => setSubtab(v)}>
            <TabsList variant='line' className='w-full justify-start'>
                <TabsTrigger value='manage'>{t('subtab_manage')}</TabsTrigger>
                <TabsTrigger value='view'>{t('subtab_view')}</TabsTrigger>
            </TabsList>
            <TabsContent value='manage'>
                {safe === 'manage' ? <ProgressOverridesManager courseId={courseId} /> : null}
            </TabsContent>
            <TabsContent value='view'>
                {safe === 'view' ? <ProgressReportView courseId={courseId} /> : null}
            </TabsContent>
        </Tabs>
    );
}
