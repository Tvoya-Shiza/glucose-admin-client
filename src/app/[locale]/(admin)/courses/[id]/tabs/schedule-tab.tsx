'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/admin/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/lib/access/use-permission';
import { listSchedules } from '@/lib/schedules/api';
import type { Schedule } from '@/lib/schedules/types';
import { SchedulesTable } from '../../../schedules/schedules-table';
import { UpsertScheduleDialog } from '../../../schedules/components/upsert-schedule-dialog';
import { DeleteScheduleDialog } from '../../../schedules/components/delete-schedule-dialog';
import { GroupContextPicker } from '../components/group-context-picker';

export function ScheduleTab({ courseId }: { courseId: number }) {
    const t = useTranslations('admin.courses');
    const tSchedules = useTranslations('admin.schedules');
    const [groupId, setGroupId] = useQueryState('schedule_group', parseAsString);

    const canCreate = usePermission('schedules.create');
    const canEdit = usePermission('schedules.edit');
    const canDelete = usePermission('schedules.delete');

    const groupIdNum = groupId && groupId.length > 0 ? Number(groupId) : undefined;

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.schedules.list', { course_id: courseId, group_id: groupIdNum, page: 1, page_size: 100 }],
        queryFn: () =>
            listSchedules({
                page: 1,
                page_size: 100,
                course_id: courseId,
                group_id: groupIdNum,
                sort: 'start_at',
                order: 'desc',
            }),
        placeholderData: (prev) => prev,
    });

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editing, setEditing] = useState<Schedule | null>(null);
    const [deleting, setDeleting] = useState<Schedule | null>(null);

    const rows = data?.rows ?? [];

    return (
        <div className='space-y-4 pt-4'>
            <div className='flex flex-wrap items-end justify-between gap-4'>
                <div className='space-y-1'>
                    <h2 className='text-lg font-semibold'>{t('schedule_tab')}</h2>
                    <p className='text-muted-foreground text-sm'>{t('schedule_pick_group_help')}</p>
                </div>
                <div className='flex items-center gap-2'>
                    <GroupContextPicker value={groupId} onChange={(v) => setGroupId(v)} />
                    {canCreate ? (
                        <Button
                            type='button'
                            onClick={() => {
                                setEditing(null);
                                setUpsertOpen(true);
                            }}
                        >
                            {tSchedules('create')}
                        </Button>
                    ) : null}
                </div>
            </div>

            <Card className='overflow-hidden p-0'>
                {error ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={tSchedules('generic_error')}
                        subtitle={(error as Error).message}
                    />
                ) : isLoading ? (
                    <div className='space-y-2 p-4'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className='h-12 w-full' />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title={groupIdNum != null ? tSchedules('empty_no_results') : tSchedules('empty_admin')}
                    />
                ) : (
                    <SchedulesTable
                        rows={rows}
                        loading={isLoading}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={(s) => {
                            setEditing(s);
                            setUpsertOpen(true);
                        }}
                        onDelete={(s) => setDeleting(s)}
                    />
                )}
            </Card>

            {(canCreate || canEdit) && (
                <UpsertScheduleDialog
                    open={upsertOpen}
                    onOpenChange={(o) => {
                        setUpsertOpen(o);
                        if (!o) setEditing(null);
                    }}
                    editing={editing}
                    defaultCourseId={courseId}
                />
            )}
            {canDelete && (
                <DeleteScheduleDialog
                    open={deleting !== null}
                    onOpenChange={(o) => {
                        if (!o) setDeleting(null);
                    }}
                    schedule={deleting}
                />
            )}
        </div>
    );
}
