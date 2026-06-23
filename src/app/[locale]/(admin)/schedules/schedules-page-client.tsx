'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { CalendarDays, ListChecks, BarChart3, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/lib/access/use-permission';
import type { Schedule, ScheduleItemKind, ScheduleStatus } from '@/lib/schedules/types';
import { EntitySearchPicker } from '@/app/[locale]/(admin)/courses/[id]/components/entity-search-picker';
import { SchedulesCalendar } from './schedules-calendar';
import { SchedulesList } from './schedules-list-client';
import { SchedulesAnalytics } from './schedules-analytics';
import { SchedulesFilters, type ScheduleFiltersValue } from './schedules-filters';
import { UpsertScheduleDialog } from './components/upsert-schedule-dialog';
import { DeleteScheduleDialog } from './components/delete-schedule-dialog';
import { CourseScheduleGrid } from './components/course-schedule-grid';

type View = 'calendar' | 'list' | 'analytics' | 'course';

export function SchedulesPageClient() {
    const t = useTranslations('admin.schedules');
    const canCreate = usePermission('schedules.create');
    const canEdit = usePermission('schedules.edit');
    const canDelete = usePermission('schedules.delete');

    const [{ view, q, status, kind, curator_id, group_id, course_id, from, to }, setQ] = useQueryStates({
        view: parseAsString.withDefault('calendar'),
        q: parseAsString,
        status: parseAsString,
        kind: parseAsString,
        curator_id: parseAsInteger,
        group_id: parseAsInteger,
        course_id: parseAsInteger,
        from: parseAsInteger,
        to: parseAsInteger,
    });

    const filtersValue: ScheduleFiltersValue = {
        q: q ?? undefined,
        status: (status as ScheduleStatus | null) ?? undefined,
        kind: (kind as ScheduleItemKind | null) ?? undefined,
        curator_id: curator_id ?? undefined,
        group_id: group_id ?? undefined,
        course_id: course_id ?? undefined,
        from: from ?? undefined,
        to: to ?? undefined,
    };

    const handleFiltersChange = (next: ScheduleFiltersValue) => {
        setQ({
            q: next.q ?? null,
            status: next.status ?? null,
            kind: next.kind ?? null,
            curator_id: next.curator_id ?? null,
            group_id: next.group_id ?? null,
            course_id: next.course_id ?? null,
            from: next.from ?? null,
            to: next.to ?? null,
        });
    };

    const [upsertOpen, setUpsertOpen] = useState(false);
    const [editing, setEditing] = useState<Schedule | null>(null);
    const [deleting, setDeleting] = useState<Schedule | null>(null);

    const onEditSchedule = (s: Schedule) => {
        setEditing(s);
        setUpsertOpen(true);
    };

    const onDeleteSchedule = (s: Schedule) => setDeleting(s);

    const currentView = (view ?? 'calendar') as View;
    const showWindowInputs = currentView !== 'calendar' && currentView !== 'course';

    return (
        <PageShell
            header={
                <PageHeader
                    title={t('list_title')}
                    subtitle={t('list_subtitle')}
                    actions={
                        canCreate ? (
                            <Button
                                onClick={() => {
                                    setEditing(null);
                                    setUpsertOpen(true);
                                }}
                            >
                                {t('create')}
                            </Button>
                        ) : null
                    }
                />
            }
            contentClassName='space-y-4'
        >
            <Tabs value={(view ?? 'calendar') as View} onValueChange={(v) => setQ({ view: v })}>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <TabsList>
                        <TabsTrigger value='calendar'>
                            <CalendarDays className='h-4 w-4' />
                            <span className='ml-1.5'>{t('tab_calendar')}</span>
                        </TabsTrigger>
                        <TabsTrigger value='list'>
                            <ListChecks className='h-4 w-4' />
                            <span className='ml-1.5'>{t('tab_list')}</span>
                        </TabsTrigger>
                        <TabsTrigger value='analytics'>
                            <BarChart3 className='h-4 w-4' />
                            <span className='ml-1.5'>{t('tab_analytics')}</span>
                        </TabsTrigger>
                        <TabsTrigger value='course'>
                            <GraduationCap className='h-4 w-4' />
                            <span className='ml-1.5'>{t('tab_course_grid')}</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                {currentView !== 'course' ? (
                    <Card className='p-4'>
                        <SchedulesFilters
                            value={filtersValue}
                            onChange={handleFiltersChange}
                            showWindowInputs={showWindowInputs}
                        />
                    </Card>
                ) : null}

                <TabsContent value='calendar' className='space-y-4'>
                    <SchedulesCalendar
                        filters={filtersValue}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={onEditSchedule}
                        onDelete={onDeleteSchedule}
                    />
                </TabsContent>

                <TabsContent value='list' className='space-y-4'>
                    <SchedulesList
                        filters={filtersValue}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={onEditSchedule}
                        onDelete={onDeleteSchedule}
                    />
                </TabsContent>

                <TabsContent value='analytics' className='space-y-4'>
                    <SchedulesAnalytics filters={filtersValue} />
                </TabsContent>

                <TabsContent value='course' className='space-y-4'>
                    <Card className='flex flex-wrap items-center gap-3 p-4'>
                        <span className='text-sm font-medium'>{t('field_course')}:</span>
                        <div className='w-72'>
                            <EntitySearchPicker
                                kind='course'
                                value={course_id != null ? String(course_id) : ''}
                                onChange={(v) => setQ({ course_id: v && v.length > 0 ? Number(v) : null })}
                            />
                        </div>
                    </Card>
                    {course_id != null ? (
                        <CourseScheduleGrid courseId={course_id} canEdit={canEdit || canCreate} />
                    ) : (
                        <p className='text-muted-foreground rounded border border-dashed p-6 text-center text-sm'>
                            {t('grid_pick_course')}
                        </p>
                    )}
                </TabsContent>
            </Tabs>

            {(canCreate || canEdit) && (
                <UpsertScheduleDialog
                    open={upsertOpen}
                    onOpenChange={(o) => {
                        setUpsertOpen(o);
                        if (!o) setEditing(null);
                    }}
                    editing={editing}
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
        </PageShell>
    );
}
