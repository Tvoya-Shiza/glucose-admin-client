'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBadge } from '@/lib/quizzes/api';
import { UpsertBadgeDialog } from '../components/upsert-badge-dialog';
import { BadgeItemsEditor } from './components/badge-items-editor';

/**
 * QZ-05 — QuizBadge detail page.
 *
 * Header: ru title (h1), kz title (muted h2), is_active state badge, "Edit" button.
 * Below: BadgeItemsEditor with sortable member quiz list + AddQuizToBadgeDialog.
 * Stats panel: item_count + results_count (read-only).
 *
 * Aggregation tab note: per the plan, the aggregate view (per-student
 * QuizBadgeResult) is read-only and DEFERRED — Plan 07 ships the actual results
 * subsystem. v1 surfaces the count only via the stats panel.
 */
export interface BadgeDetailClientProps {
    badgeId: number;
}

export function BadgeDetailClient({ badgeId }: BadgeDetailClientProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin.quiz-badges.detail', badgeId],
        queryFn: () => getBadge(badgeId),
    });

    const [editOpen, setEditOpen] = useState(false);

    if (isLoading) {
        return <div className='text-muted-foreground p-6'>{t('loading')}</div>;
    }

    if (isError || !data) {
        return (
            <div className='space-y-4 p-6'>
                <Link
                    href={`/${locale}/quizzes/badges`}
                    className='text-muted-foreground inline-flex items-center text-sm hover:underline'
                >
                    <ArrowLeft className='mr-1 h-4 w-4' />
                    {t('back_to_badges')}
                </Link>
                <p className='text-destructive'>{t('badge_not_found')}</p>
            </div>
        );
    }

    const ruTitle = data.translations.ru?.trim() ?? '';
    const kzTitle = data.translations.kz?.trim() ?? '';
    const headerLabel = ruTitle.length > 0 ? ruTitle : `#${data.id}`;

    return (
        <div className='space-y-6 p-4'>
            <div>
                <Link
                    href={`/${locale}/quizzes/badges`}
                    className='text-muted-foreground mb-2 inline-flex items-center text-sm hover:underline'
                >
                    <ArrowLeft className='mr-1 h-4 w-4' />
                    {t('back_to_badges')}
                </Link>
                <div className='flex items-start justify-between gap-3'>
                    <div className='space-y-1'>
                        <h1 className='text-2xl font-bold break-words'>{headerLabel}</h1>
                        {kzTitle.length > 0 ? (
                            <h2 className='text-muted-foreground text-base'>{kzTitle}</h2>
                        ) : null}
                        <div className='flex flex-wrap items-center gap-2'>
                            <Badge variant={data.is_active ? 'default' : 'secondary'}>
                                {data.is_active ? t('badge_active') : t('badge_inactive')}
                            </Badge>
                            <span className='text-muted-foreground text-xs'>
                                {t('badge_id_label', { id: data.id })}
                            </span>
                        </div>
                    </div>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => setEditOpen(true)}
                    >
                        <Pencil className='mr-2 h-4 w-4' />
                        {t('edit_badge')}
                    </Button>
                </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            {t('badge_item_count_label')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='text-2xl font-bold'>{data.item_count}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            {t('badge_results_count_label')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='text-2xl font-bold'>{data.results_count}</div>
                        <p className='text-muted-foreground mt-1 text-xs'>
                            {t('badge_results_aggregation_hint')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <BadgeItemsEditor badgeId={data.id} items={data.items} />

            <UpsertBadgeDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                initial={{
                    id: data.id,
                    is_active: data.is_active,
                    quiz_category_id: data.quiz_category_id,
                    ru_title: data.translations.ru ?? '',
                    kz_title: data.translations.kz ?? '',
                }}
            />
        </div>
    );
}
