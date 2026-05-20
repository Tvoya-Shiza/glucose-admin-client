'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { UserPicker } from '@/components/users/user-picker';
import { changeCourseTeacher } from '@/lib/courses/api';
import type { CourseDetail } from '@/lib/courses/types';

/**
 * CRS-06 — course-author reassignment dialog (Plan 07).
 *
 * Mirrors Phase 4 Plan 03 SupervisorChangeDialog verbatim. Differences:
 *   - field name: `teacher_id` (admin-api ChangeTeacherDto.teacher_id, NOT NULL).
 *     There is NO "0 = clear assignment" sentinel — Webinar.teacher_id is NOT NULL
 *     on schema, so the input requires a positive integer. (>=1 enforced by zod.)
 *   - error key surface: 'courses.teacher_not_found' surfaces as the localized
 *     "Указанный пользователь не является преподавателем" copy.
 *   - visibility: caller (course-detail-client) gates the trigger button via
 *     usePermission('courses.edit'). Server enforces too via @RequirePermission
 *     on the endpoint — the client check is UX, not security.
 *
 * AUDIT METADATA — `previous_teacher_id` strip (Phase 4 Plan 03 trick):
 *   The admin-api response carries `previous_teacher_id` so AuditInterceptor records
 *   the before-state via response shape. We MUST strip this audit-only field before
 *   calling `qc.setQueryData(['admin.courses.detail', courseId], detailOnly)` so the
 *   cache shape stays a clean CourseDetail.
 *
 * Cache invalidation:
 *   - setQueryData on ['admin.courses.detail', courseId] — page updates without round-trip.
 *   - invalidateQueries(['admin.courses.list']) — list row refreshes if user navigates back.
 *   - invalidateQueries(['admin.courses.preview', courseId]) — preview tab is teacher-aware.
 */
const schema = z.object({
    teacher_id: z
        .string()
        .refine(
            (v) => v.trim() !== '' && Number.isFinite(Number(v.trim())) && Number(v.trim()) >= 1 && Number.isInteger(Number(v.trim())),
            { message: 'invalid_teacher_id' },
        ),
    reason: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export interface TeacherChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    course: CourseDetail;
    onChanged?: () => void;
}

export function TeacherChangeDialog({ open, onOpenChange, course, onChanged }: TeacherChangeDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            teacher_id: course.teacher ? String(course.teacher.id) : '',
            reason: '',
        },
        mode: 'onSubmit',
    });

    // Reset on open/close so re-open shows fresh state.
    useEffect(() => {
        if (open) {
            form.reset({
                teacher_id: course.teacher ? String(course.teacher.id) : '',
                reason: '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, course.teacher?.id]);

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const raw = values.teacher_id.trim();
            const parsed = Number(raw);
            return changeCourseTeacher(course.id, {
                teacher_id: Number.isFinite(parsed) && parsed >= 1 ? parsed : 0,
                reason: values.reason?.trim() ? values.reason.trim() : undefined,
            });
        },
        onSuccess: (next) => {
            // Strip previous_teacher_id (audit-only metadata; not part of the cached CourseDetail shape).
            // The response carries CourseDetail + previous_teacher_id; we narrow it here so the cache
            // shape stays a clean CourseDetail. Phase 4 Plan 03 SupervisorChangeDialog precedent.
            const withMeta = next as CourseDetail & { previous_teacher_id?: number | null };
            const detailOnly: CourseDetail = {
                id: withMeta.id,
                slug: withMeta.slug,
                type: withMeta.type,
                status: withMeta.status,
                teacher: withMeta.teacher,
                category: withMeta.category,
                image_cover: withMeta.image_cover,
                thumbnail: withMeta.thumbnail,
                capacity: withMeta.capacity,
                certificate: withMeta.certificate,
                is_paid: withMeta.is_paid,
                strict_progress: withMeta.strict_progress,
                pricing: withMeta.pricing,
                start_date: withMeta.start_date,
                duration: withMeta.duration,
                position: withMeta.position,
                created_at: withMeta.created_at,
                updated_at: withMeta.updated_at,
                deleted_at: withMeta.deleted_at,
                translations: withMeta.translations,
                translation_completeness: withMeta.translation_completeness,
                missing_locales: withMeta.missing_locales,
                chapters: withMeta.chapters,
                counts: withMeta.counts,
            };
            qc.setQueryData(['admin.courses.detail', course.id], detailOnly);
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.courses.preview', course.id], exact: false });
            toast.success(t('teacher_change_success'));
            onChanged?.();
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            // Surface dedicated copy for the "target user not a teacher / not found" case.
            if (msg.includes('courses.teacher_not_found') || msg.includes('404')) {
                toast.error(t('teacher_not_teacher_role'));
            } else if (msg.includes('courses.forbidden_admin_only') || msg.includes('403')) {
                toast.error(t('forbidden_scope'));
            } else {
                toast.error(t('teacher_change_error'));
            }
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('teacher_change_title')}</DialogTitle>
                    <DialogDescription>{t('teacher_change_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='teacher_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('teacher_label')}</FormLabel>
                                    <FormControl>
                                        <UserPicker
                                            roles={['teacher']}
                                            value={
                                                field.value && Number(field.value) >= 1
                                                    ? Number(field.value)
                                                    : null
                                            }
                                            onChange={(id) => field.onChange(id ? String(id) : '')}
                                            placeholder={t('teacher_placeholder')}
                                            disabled={mutation.isPending}
                                            initialLabel={
                                                course.teacher
                                                    ? (course.teacher.full_name ?? `#${course.teacher.id}`)
                                                    : null
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='reason'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('teacher_change_reason')}</FormLabel>
                                    <FormControl>
                                        <Input maxLength={500} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
