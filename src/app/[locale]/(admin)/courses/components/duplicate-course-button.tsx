'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { usePermission } from '@/lib/access/use-permission';
import { duplicateCourse } from '@/lib/courses/api';

export interface DuplicateCourseButtonProps {
    courseId: number;
    /** Render as a DropdownMenuItem (table row action) when true; standalone Button otherwise. */
    asMenuItem?: boolean;
}

/**
 * CRS-DUP — duplicate-course trigger.
 *
 * Calls duplicateCourse(id) (POST /admin-api/v1/admin/courses/:id/duplicate). On success:
 *   - Toast 'duplicate_success'
 *   - Invalidate ['admin.courses.list']
 *   - Navigate to the new (draft) course's detail page
 *
 * Gated by the `courses.create` permission (same code the API requires). Hidden entirely
 * when the actor lacks it. Two render modes mirror DuplicateQuizButton:
 *   - asMenuItem=true: DropdownMenuItem inside the table row Actions menu
 *   - asMenuItem=false: standalone Button (course detail header toolbar)
 */
export function DuplicateCourseButton({ courseId, asMenuItem = false }: DuplicateCourseButtonProps) {
    const t = useTranslations('admin.courses');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();
    const canCreate = usePermission('courses.create');

    const mutation = useMutation({
        mutationFn: () => duplicateCourse(courseId),
        onSuccess: (created) => {
            toast.success(t('duplicate_success'));
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            router.push(`/${locale}/courses/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    if (!canCreate) return null;

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
