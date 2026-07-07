'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CoursePicker } from '@/components/courses/course-picker';
import { GroupPicker } from '@/components/groups/group-picker';
import { getCourse } from '@/lib/courses/api';
import { chapterDisplayTitle, chapterItemDisplayTitle } from '@/lib/credits/format';

/**
 * Shared credit form (create dialog + overview edit tab): title, description,
 * group picker, course picker, chapter select (chapters come from the existing
 * admin courses detail endpoint via lib/courses getCourse), lesson multi-select
 * from the chosen chapter's items, scheduled datetime.
 */

export function buildCreditFormSchema(t: (key: string) => string) {
    return z.object({
        title: z.string().min(1, t('validation_required')).max(255, t('validation_too_long')),
        description: z.string(),
        // NOTE: the refine callbacks are annotated `: boolean` on purpose — TS 5.5+
        // would otherwise infer a type predicate (`v is number`) and zod would
        // narrow the OUTPUT type to non-null, breaking the null defaultValues.
        group_id: z
            .number()
            .int()
            .nullable()
            .refine((v): boolean => v != null, { message: t('validation_required') }),
        course_id: z
            .number()
            .int()
            .nullable()
            .refine((v): boolean => v != null, { message: t('validation_required') }),
        chapter_id: z
            .number()
            .int()
            .nullable()
            .refine((v): boolean => v != null, { message: t('validation_required') }),
        lesson_item_ids: z.array(z.number().int()),
        /** `<input type='datetime-local'>` value; '' = not scheduled. */
        scheduled_at: z.string(),
    });
}

export type CreditFormValues = z.infer<ReturnType<typeof buildCreditFormSchema>>;

export const CREDIT_FORM_EMPTY: CreditFormValues = {
    title: '',
    description: '',
    group_id: null,
    course_id: null,
    chapter_id: null,
    lesson_item_ids: [],
    scheduled_at: '',
};

export interface CreditFormFieldsProps {
    form: UseFormReturn<CreditFormValues>;
    disabled?: boolean;
}

export function CreditFormFields({ form, disabled = false }: CreditFormFieldsProps) {
    const t = useTranslations('admin.credits');

    const courseId = form.watch('course_id');
    const chapterId = form.watch('chapter_id');

    const courseDetail = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId as number),
        enabled: courseId != null,
        staleTime: 60_000,
    });

    const chapters = useMemo(() => courseDetail.data?.chapters ?? [], [courseDetail.data]);
    const selectedChapter = useMemo(() => chapters.find((ch) => ch.id === chapterId) ?? null, [chapters, chapterId]);

    return (
        <>
            <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('title_label')}</FormLabel>
                        <FormControl>
                            <Input {...field} disabled={disabled} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('description_label')}</FormLabel>
                        <FormControl>
                            <Textarea rows={3} {...field} disabled={disabled} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className='grid gap-3 sm:grid-cols-2'>
                <FormField
                    control={form.control}
                    name='group_id'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('group_label')}</FormLabel>
                            <FormControl>
                                <GroupPicker
                                    value={field.value ?? null}
                                    onChange={(id) => field.onChange(id)}
                                    placeholder={t('group_placeholder')}
                                    disabled={disabled}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='course_id'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('course_label')}</FormLabel>
                            <FormControl>
                                <CoursePicker
                                    value={field.value ?? null}
                                    onChange={(id) => {
                                        field.onChange(id);
                                        form.setValue('chapter_id', null);
                                        form.setValue('lesson_item_ids', []);
                                    }}
                                    placeholder={t('course_placeholder')}
                                    disabled={disabled}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name='chapter_id'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('chapter_label')}</FormLabel>
                        <Select
                            value={field.value != null ? String(field.value) : ''}
                            onValueChange={(v) => {
                                field.onChange(Number(v));
                                form.setValue('lesson_item_ids', []);
                            }}
                            disabled={disabled || courseId == null}
                        >
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={courseId == null ? t('select_course_first') : t('chapter_placeholder')} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {chapters.length === 0 ? (
                                    <div className='text-muted-foreground p-2 text-xs'>
                                        {courseDetail.isFetching ? t('loading') : t('no_chapters')}
                                    </div>
                                ) : (
                                    chapters.map((ch) => (
                                        <SelectItem key={ch.id} value={String(ch.id)}>
                                            {chapterDisplayTitle(ch)}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name='lesson_item_ids'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('lessons_label')}</FormLabel>
                        {selectedChapter == null ? (
                            <p className='text-muted-foreground text-xs'>{t('select_chapter_first')}</p>
                        ) : selectedChapter.items.length === 0 ? (
                            <p className='text-muted-foreground text-xs'>{t('no_lessons')}</p>
                        ) : (
                            <div className='max-h-48 space-y-1 overflow-auto rounded border p-2'>
                                {selectedChapter.items.map((item) => {
                                    const checked = field.value.includes(item.id);
                                    return (
                                        <label key={item.id} className='flex items-center gap-2 text-sm'>
                                            <Checkbox
                                                checked={checked}
                                                disabled={disabled}
                                                onCheckedChange={(v) =>
                                                    field.onChange(
                                                        v ? [...field.value, item.id] : field.value.filter((id) => id !== item.id)
                                                    )
                                                }
                                            />
                                            <span className='truncate'>{chapterItemDisplayTitle(item)}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name='scheduled_at'
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('scheduled_label')}</FormLabel>
                        <FormControl>
                            <Input type='datetime-local' {...field} disabled={disabled} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
