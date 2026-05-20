'use client';

import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAssignment } from '@/lib/assignments/api';
import type { AssignmentDetail } from '@/lib/assignments/types';
import { AssignmentsDashboard } from '../assignments-dashboard';
import { OverviewTab } from './tabs/overview-tab';
import { AttachmentsTab } from './tabs/attachments-tab';
import { SubmissionsTab } from './tabs/submissions-tab';

interface AssignmentDetailClientProps {
    assignmentId: number;
}

export function AssignmentDetailClient({ assignmentId }: AssignmentDetailClientProps) {
    const t = useTranslations('admin.assignments');

    const { data, isLoading, error } = useQuery<AssignmentDetail>({
        queryKey: ['admin.assignments.detail', assignmentId],
        queryFn: () => getAssignment(assignmentId),
    });

    const ru = data?.translations.find((x) => x.locale === 'ru');
    const kz = data?.translations.find((x) => x.locale === 'kz');
    const title = kz?.title || ru?.title || `#${assignmentId}`;

    return (
        <PageShell
            header={
                <PageHeader
                    title={isLoading ? t('loading') : title}
                    subtitle={
                        data ? (
                            <span className='flex items-center gap-2'>
                                <Badge variant={data.status === 'active' ? 'default' : 'secondary'}>
                                    {data.status === 'active' ? t('status_active') : t('status_inactive')}
                                </Badge>
                                <span className='text-muted-foreground'>
                                    {t('col_course')} #{data.webinar_id} · {t('col_submissions')}: {data.submission_count}
                                </span>
                            </span>
                        ) : null
                    }
                    actions={
                        <Button asChild variant='ghost' size='sm'>
                            <Link href='/assignments'>
                                <ChevronLeft className='mr-1 h-4 w-4' />
                                {t('back_to_list')}
                            </Link>
                        </Button>
                    }
                />
            }
            contentClassName='space-y-4'
        >
            {error ? (
                <div className='rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'>
                    {(error as Error).message}
                </div>
            ) : null}

            {isLoading || !data ? (
                <div className='space-y-3'>
                    <Skeleton className='h-12 w-full' />
                    <Skeleton className='h-64 w-full' />
                </div>
            ) : (
                <>
                    <AssignmentsDashboard assignmentId={assignmentId} />
                    <Tabs defaultValue='overview'>
                        <TabsList>
                            <TabsTrigger value='overview'>{t('overview_tab')}</TabsTrigger>
                            <TabsTrigger value='attachments'>
                                {t('attachments_tab')} ({data.attachments.length}/5)
                            </TabsTrigger>
                            <TabsTrigger value='submissions'>
                                {t('submissions_tab')} ({data.submission_count})
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value='overview' className='pt-4'>
                            <OverviewTab detail={data} />
                        </TabsContent>
                        <TabsContent value='attachments' className='pt-4'>
                            <AttachmentsTab detail={data} />
                        </TabsContent>
                        <TabsContent value='submissions' className='pt-4'>
                            <SubmissionsTab assignmentId={assignmentId} />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </PageShell>
    );
}
