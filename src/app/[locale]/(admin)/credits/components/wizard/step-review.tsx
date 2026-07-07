'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { CreditEligibleStudent, CreditTopic } from '@/lib/credits/types';
import type { LaunchWizardValues } from './launch-wizard-form';

export interface StepReviewProps {
    form: UseFormReturn<LaunchWizardValues>;
    students: CreditEligibleStudent[];
    topics: CreditTopic[];
}

/** Wizard step 4 — read-only summary before «Бастау». */
export function StepReview({ form, students, topics }: StepReviewProps) {
    const t = useTranslations('admin.credits');
    const values = form.watch();

    const selectedStudents = useMemo(() => students.filter((s) => values.student_ids.includes(s.id)), [students, values.student_ids]);
    const selectedTopics = useMemo(() => topics.filter((topic) => values.topic_ids.includes(topic.id)), [topics, values.topic_ids]);

    const totalQuestions = values.topic_ids.length * values.question_count;

    return (
        <div className='space-y-4 text-sm'>
            <div>
                <p className='mb-1.5 font-medium'>
                    {t('review_students')} ({selectedStudents.length})
                </p>
                <div className='flex max-h-28 flex-wrap gap-1.5 overflow-auto'>
                    {selectedStudents.map((s) => (
                        <Badge key={s.id} variant='outline'>
                            {s.full_name}
                        </Badge>
                    ))}
                </div>
            </div>
            <Separator />
            <div>
                <p className='mb-1.5 font-medium'>
                    {t('review_topics')} ({selectedTopics.length})
                </p>
                <div className='flex max-h-28 flex-wrap gap-1.5 overflow-auto'>
                    {selectedTopics.map((topic) => (
                        <Badge key={topic.id} variant='outline'>
                            {topic.name}
                        </Badge>
                    ))}
                </div>
            </div>
            <Separator />
            <dl className='grid gap-x-6 gap-y-2 sm:grid-cols-2'>
                <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>{t('question_count_label')}</dt>
                    <dd className='font-medium tabular-nums'>{values.question_count}</dd>
                </div>
                <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>{t('review_total_questions')}</dt>
                    <dd className='font-medium tabular-nums'>{totalQuestions}</dd>
                </div>
                <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>{t('template_label')}</dt>
                    <dd className='font-mono text-xs'>{values.difficulty_template.join(' ')}</dd>
                </div>
                <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>{t('review_duration')}</dt>
                    <dd className='font-medium'>{t('review_minutes', { minutes: values.duration_min })}</dd>
                </div>
                <div className='flex justify-between gap-2'>
                    <dt className='text-muted-foreground'>{t('review_pass')}</dt>
                    <dd className='font-medium'>
                        {values.pass_value}
                        {values.pass_type === 'percent' ? '%' : ` ${t('points_suffix')}`}
                    </dd>
                </div>
            </dl>
        </div>
    );
}
