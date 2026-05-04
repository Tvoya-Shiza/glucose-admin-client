'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { listQuestions } from '@/lib/quizzes/api';
import { QuestionsList } from '../components/questions-list';

/**
 * Questions tab — Phase 6 Plan 05 real implementation.
 *
 * Replaces Plan 04's placeholder. Renders <QuestionsList> with dnd-kit reorder,
 * Add Question button, and per-row Edit/Delete actions. The list, the
 * UpsertQuestionDialog, AnswersEditor, and IdentificativePairsEditor each handle
 * their own ForceConfirmDialog when 409 ForceConfirmRequiredError surfaces.
 *
 * Query key: ['admin.quizzes.questions', quizId]. Server-side cache TTL 60s
 * (geonline-admin:quizzes:questions:<id>); admin mutations invalidate
 * geonline-admin:quizzes:* aggressively per D-26.
 */
export function QuestionsTab({ quizId }: { quizId: number }) {
    const t = useTranslations('admin.quizzes');
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin.quizzes.questions', quizId],
        queryFn: () => listQuestions(quizId),
        retry: false,
    });

    if (isLoading) {
        return (
            <div className='space-y-2 p-4'>
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
                <Skeleton className='h-10 w-full' />
            </div>
        );
    }

    if (error) {
        const msg = error instanceof Error ? error.message : '';
        return (
            <div className='p-4'>
                <Alert variant='destructive'>
                    <AlertTitle>{t('generic_error')}</AlertTitle>
                    <AlertDescription>{msg}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className='p-4'>
            <QuestionsList quizId={quizId} questions={data?.rows ?? []} />
        </div>
    );
}
