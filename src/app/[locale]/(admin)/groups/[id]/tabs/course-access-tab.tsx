'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { GrantCourseAccessDialog } from '../components/grant-course-access-dialog';
import { GroupCourseAccessTable } from '../components/group-course-access-table';

export interface CourseAccessTabProps {
    groupId: number;
}

/**
 * Phase 18 — Feature A tab on /kz/groups/[id].
 *
 * Header: optional "Grant access" button (gated by course_access.grant).
 * Body:   GroupCourseAccessTable.
 *
 * Lazy-mounted by group-detail-client (`{safeTab === 'course-access' ? <Tab /> : null}`)
 * so listGroupGrants does not fire on first paint when the operator only wants
 * Overview / Members.
 */
export function CourseAccessTab({ groupId }: CourseAccessTabProps) {
    const t = useTranslations('admin.course_access');
    const canGrant = usePermission('course_access.grant');
    const [grantOpen, setGrantOpen] = useState(false);

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>{t('list_title')}</h2>
                {canGrant ? <Button onClick={() => setGrantOpen(true)}>{t('grant')}</Button> : null}
            </div>
            <GroupCourseAccessTable groupId={groupId} />
            {canGrant ? (
                <GrantCourseAccessDialog open={grantOpen} onOpenChange={setGrantOpen} groupId={groupId} />
            ) : null}
        </div>
    );
}
