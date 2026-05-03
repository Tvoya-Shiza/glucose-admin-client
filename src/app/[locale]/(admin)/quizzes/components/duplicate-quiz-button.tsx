'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { duplicateQuiz } from '@/lib/quizzes/api';

export interface DuplicateQuizButtonProps {
    quizId: number;
    /** Render as a DropdownMenuItem (table row action) when true; standalone Button otherwise. */
    asMenuItem?: boolean;
}

/**
 * QZ-07 — duplicate-quiz trigger.
 *
 * Calls duplicateQuiz(id) (POST /admin-api/v1/admin/quizzes/:id/duplicate). On success:
 *   - Toast 'duplicate_success'
 *   - Invalidate ['admin.quizzes.list']
 *   - Navigate to the new quiz's detail page (D-20: lands on detail editor immediately)
 *
 * Available to admin and teacher (controller @Roles + service scope check both honor D-21).
 *
 * Two render modes:
 *   - asMenuItem=true: DropdownMenuItem inside row Actions menu
 *   - asMenuItem=false: standalone Button (used on detail page toolbar in Plan 04)
 */
export function DuplicateQuizButton({ quizId, asMenuItem = false }: DuplicateQuizButtonProps) {
    const t = useTranslations('admin.quizzes');
    const locale = useLocale() as 'ru' | 'kz';
    const router = useRouter();
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => duplicateQuiz(quizId),
        onSuccess: (created) => {
            toast.success(t('duplicate_success'));
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'], exact: false });
            router.push(`/${locale}/quizzes/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    if (asMenuItem) {
        return (
            <DropdownMenuItem
                disabled={mutation.isPending}
                onClick={(e) => {
                    e.preventDefault();
                    mutation.mutate();
                }}
            >
                {mutation.isPending ? t('loading') : t('duplicate')}
            </DropdownMenuItem>
        );
    }

    return (
        <Button variant='outline' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('loading') : t('duplicate')}
        </Button>
    );
}
