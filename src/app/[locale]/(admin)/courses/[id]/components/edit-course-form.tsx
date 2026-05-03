'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { updateCourse } from '@/lib/courses/api';
import { SLUG_REGEX } from '@/lib/courses/format';
import type { CourseDetail, CourseStatus, Translation } from '@/lib/courses/types';
import { CoverImageUploaderStub } from './cover-image-uploader-stub';
import { TranslationForm } from './translation-form';

/**
 * CRS-01 + CRS-02 — inline edit form for the Course detail Overview tab (Plan 03).
 *
 * Single rhf+zod form covering everything Overview can edit:
 *   - non-translation fields: slug, status, category_id (numeric — autocomplete picker
 *     deferred to a future polish phase, mirroring Plan 02 CreateCourseDialog).
 *   - translation fields: side-by-side RU + KZ title + description (CONTEXT D-06).
 *
 * Edit-in-place mirror of Phase 4 Plan 03 EditGroupForm:
 *   - onMutate snapshots ['admin.courses.detail', courseId] for rollback.
 *   - onSuccess setQueryData replaces detail cache with the server's authoritative
 *     CourseDetail AND invalidates ['admin.courses.list'] so the list page badge
 *     reflects the new translation completeness when the user navigates back.
 *   - onError rolls back the snapshot + toasts.
 *
 * Teacher field is rendered read-only by the parent OverviewTab (Plan 07's
 * <TeacherChangeDialog> is a separate component). Cover image goes through the
 * <CoverImageUploaderStub> until Plan 04 lands the upload-token flow.
 *
 * Save semantics:
 *   - We always send ALL non-empty translations (RU + KZ) so the user can fix a
 *     missing-locale state by typing in one tab and saving (admin-api PATCH upserts
 *     by locale per Plan 02's find-then-update path).
 *   - A locale's title=='' is REJECTED at the form level (zod min(1)) — we don't want
 *     a user accidentally clearing a translation row by leaving title blank.
 *     If a teacher truly wants to delete a translation, the workflow is "blank both
 *     fields and the save validates min(1)" — failing safe.
 */
const translationSchema = z.object({
    title: z.string().min(1, 'title_required').max(255),
    description: z.string().max(65535).optional().or(z.literal('')),
});

const schema = z.object({
    slug: z
        .string()
        .min(3)
        .max(255)
        .regex(SLUG_REGEX, 'slug_invalid_format'),
    status: z.enum(['active', 'pending', 'is_draft', 'inactive']),
    category_id: z
        .string()
        .refine(
            (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number.isInteger(Number(v))),
            { message: 'category_id_invalid' },
        ),
    ru: translationSchema,
    kz: translationSchema,
});
type Values = z.infer<typeof schema>;

export interface EditCourseFormProps {
    course: CourseDetail;
    onCancel: () => void;
    onSaved: () => void;
}

export function EditCourseForm({ course, onCancel, onSaved }: EditCourseFormProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();

    const initialRu = course.translations.find((tr) => tr.locale === 'ru');
    const initialKz = course.translations.find((tr) => tr.locale === 'kz');

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            slug: course.slug,
            status: course.status,
            category_id: course.category ? String(course.category.id) : '',
            ru: {
                title: initialRu?.title ?? '',
                description: initialRu?.description ?? '',
            },
            kz: {
                title: initialKz?.title ?? '',
                description: initialKz?.description ?? '',
            },
        },
        mode: 'onSubmit',
    });

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const translations: Translation[] = [
                {
                    locale: 'ru',
                    title: values.ru.title,
                    description: values.ru.description?.trim() ? values.ru.description : null,
                },
                {
                    locale: 'kz',
                    title: values.kz.title,
                    description: values.kz.description?.trim() ? values.kz.description : null,
                },
            ];
            const cat = values.category_id.trim();
            return updateCourse(course.id, {
                slug: values.slug,
                status: values.status as CourseStatus,
                category_id: cat === '' ? null : Number(cat),
                translations,
            });
        },
        onMutate: () => {
            const prev = qc.getQueryData<CourseDetail>(['admin.courses.detail', course.id]);
            return { prev };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(['admin.courses.detail', course.id], ctx.prev);
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
        onSuccess: (next) => {
            qc.setQueryData(['admin.courses.detail', course.id], next);
            qc.invalidateQueries({ queryKey: ['admin.courses.list'], exact: false });
            toast.success(t('saved'));
            onSaved();
        },
    });

    const errors = form.formState.errors;
    const ruValues = form.watch('ru');
    const kzValues = form.watch('kz');

    return (
        <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='space-y-5 pt-4'
        >
            {/* Cover image (stub until Plan 04) */}
            <div className='space-y-1'>
                <Label>{t('cover_label')}</Label>
                <CoverImageUploaderStub imageCover={course.image_cover} />
            </div>

            {/* Side-by-side RU + KZ translations */}
            <div className='grid gap-4 md:grid-cols-2'>
                <Controller
                    control={form.control}
                    name='ru'
                    render={({ field }) => (
                        <TranslationForm
                            locale='ru'
                            title={field.value.title}
                            description={field.value.description ?? ''}
                            onTitleChange={(v) => field.onChange({ ...ruValues, title: v })}
                            onDescriptionChange={(v) =>
                                field.onChange({ ...ruValues, description: v })
                            }
                            titleError={
                                errors.ru?.title?.message
                                    ? t('title_required')
                                    : undefined
                            }
                            disabled={mutation.isPending}
                        />
                    )}
                />
                <Controller
                    control={form.control}
                    name='kz'
                    render={({ field }) => (
                        <TranslationForm
                            locale='kz'
                            title={field.value.title}
                            description={field.value.description ?? ''}
                            onTitleChange={(v) => field.onChange({ ...kzValues, title: v })}
                            onDescriptionChange={(v) =>
                                field.onChange({ ...kzValues, description: v })
                            }
                            titleError={
                                errors.kz?.title?.message
                                    ? t('title_required')
                                    : undefined
                            }
                            disabled={mutation.isPending}
                        />
                    )}
                />
            </div>

            {/* Field grid: slug / status / category / teacher (read-only) */}
            <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-1'>
                    <Label htmlFor='slug'>{t('slug_label')}</Label>
                    <Input
                        id='slug'
                        {...form.register('slug')}
                        placeholder={t('slug_placeholder')}
                        disabled={mutation.isPending}
                    />
                    {errors.slug ? (
                        <p className='text-destructive text-xs'>
                            {errors.slug.message === 'slug_invalid_format'
                                ? t('slug_invalid_format')
                                : t('validation_failed')}
                        </p>
                    ) : null}
                </div>

                <div className='space-y-1'>
                    <Label htmlFor='status'>{t('status_label')}</Label>
                    <Controller
                        control={form.control}
                        name='status'
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={mutation.isPending}
                            >
                                <SelectTrigger id='status'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                                    <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                                    <SelectItem value='is_draft'>
                                        {t('status_is_draft')}
                                    </SelectItem>
                                    <SelectItem value='inactive'>
                                        {t('status_inactive')}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>

                <div className='space-y-1'>
                    <Label htmlFor='category_id'>{t('category_label')}</Label>
                    <Input
                        id='category_id'
                        inputMode='numeric'
                        {...form.register('category_id')}
                        placeholder={t('category_placeholder')}
                        disabled={mutation.isPending}
                    />
                </div>

                <div className='space-y-1'>
                    <Label>{t('teacher_label')}</Label>
                    <div className='text-muted-foreground rounded border bg-muted px-3 py-2 text-sm'>
                        {course.teacher
                            ? `${course.teacher.full_name ?? `user#${course.teacher.id}`} (id ${course.teacher.id})`
                            : '—'}
                    </div>
                </div>
            </div>

            <div className='flex gap-2'>
                <Button type='submit' disabled={mutation.isPending}>
                    {mutation.isPending ? t('saving') : t('save')}
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    onClick={onCancel}
                    disabled={mutation.isPending}
                >
                    {t('cancel')}
                </Button>
            </div>
        </form>
    );
}
