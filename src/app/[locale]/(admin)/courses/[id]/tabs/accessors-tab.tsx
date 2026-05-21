'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/access/use-permission';
import { AccessorsSummaryCards } from '../components/accessors-summary-cards';
import { AccessorsTable } from '../components/accessors-table';
import { GrantDirectAccessDialog } from '../components/grant-direct-access-dialog';

export interface AccessorsTabProps {
    courseId: number;
}

/**
 * Phase 19 / Feature C — "Доступы" tab on /kz/courses/[id].
 *
 * Lazy-mounted from course-detail-client (`{safeTab === 'accessors' ? ... : null}`).
 * Hosts the summary KPIs + unified accessors table + grant-direct dialog.
 */
export function AccessorsTab({ courseId }: AccessorsTabProps) {
    const t = useTranslations('admin.course_access');
    const canGrant = usePermission('course_access.grant');
    const [grantOpen, setGrantOpen] = useState(false);

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <h2 className='text-lg font-semibold'>{t('accessors_title')}</h2>
                {canGrant ? <Button onClick={() => setGrantOpen(true)}>{t('grant_direct')}</Button> : null}
            </div>
            <AccessorsSummaryCards courseId={courseId} />
            <AccessorsTable courseId={courseId} />
            {canGrant ? (
                <GrantDirectAccessDialog open={grantOpen} onOpenChange={setGrantOpen} courseId={courseId} />
            ) : null}
        </div>
    );
}
