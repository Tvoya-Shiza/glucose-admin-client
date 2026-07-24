'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUploader } from '@/components/ui/file-uploader';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { QuizCategoryPicker } from '@/components/quizzes/quiz-category-picker';
import { MultiCoursePicker } from '@/components/trainers/multi-course-picker';
import { usePermission } from '@/lib/access/use-permission';
import { updateTrainer } from '@/lib/trainers/api';
import { localInputToUnix, unixToLocalInput } from '@/lib/trainers/datetime';
import type { TrainerDetail, UpdateTrainer } from '@/lib/trainers/types';

/**
 * Phase 38 — trainer Settings tab (ТЗ §5 trainer_settings).
 *
 * react-hook-form + zod over the full settings surface. Cross-field rules mirror
 * the admin-api service so the UI fails fast:
 *   - seconds_per_question required (5..600) when timer_enabled=true.
 *   - available_from < available_to when both are set.
 *
 * attempts_limit uses 0 = unlimited (NOT null) per the ТЗ — the field defaults to
 * '0' (the server maps 0 → NULL and returns null, which we render back as 0).
 *
 * Submit → updateTrainer, toast, invalidate detail + list. Edit controls are
 * wrapped in a disabled <fieldset> unless the actor holds `trainers.edit`.
 */
const settingsSchema = z
    .object({
        title: z.string().min(1).max(500),
        category_id: z.number().int().positive().nullable(),
        timer_enabled: z.boolean(),
        seconds_per_question: z.string(),
        shuffle_questions: z.boolean(),
        shuffle_answers: z.boolean(),
        flashcards_enabled: z.boolean(),
        attempts_limit: z.string(),
        available_from: z.string(),
        available_to: z.string(),
        background_image: z.string().nullable(),
        courses: z.array(z.object({ id: z.number(), title: z.string().nullable() })),
    })
    .superRefine((vals, ctx) => {
        if (vals.timer_enabled) {
            const n = Number((vals.seconds_per_question ?? '').trim());
            if (!Number.isInteger(n) || n < 5 || n > 600) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['seconds_per_question'], message: 'seconds_invalid' });
            }
        }
        const from = localInputToUnix(vals.available_from);
        const to = localInputToUnix(vals.available_to);
        if (from != null && to != null && from >= to) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['available_to'], message: 'availability_invalid' });
        }
    });

type SettingsValues = z.infer<typeof settingsSchema>;

function toDefaults(trainer: TrainerDetail): SettingsValues {
    return {
        title: trainer.title_kz ?? '',
        category_id: trainer.category?.id ?? null,
        timer_enabled: trainer.timer_enabled,
        seconds_per_question: trainer.seconds_per_question != null ? String(trainer.seconds_per_question) : '',
        shuffle_questions: trainer.shuffle_questions,
        shuffle_answers: trainer.shuffle_answers,
        flashcards_enabled: trainer.flashcards_enabled,
        attempts_limit: String(trainer.attempts_limit ?? 0),
        available_from: unixToLocalInput(trainer.available_from),
        available_to: unixToLocalInput(trainer.available_to),
        background_image: trainer.background_image,
        courses: trainer.courses.map((c) => ({ id: c.id, title: c.title_kz })),
    };
}

export function SettingsTab({ trainer }: { trainer: TrainerDetail }) {
    const t = useTranslations('admin.trainers');
    const qc = useQueryClient();
    const canEdit = usePermission('trainers.edit');

    const form = useForm<SettingsValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: toDefaults(trainer),
        mode: 'onSubmit',
    });

    // Re-seed the form when a fresh detail arrives (e.g. after a successful save
    // invalidation) — updated_at moves on every server write.
    useEffect(() => {
        form.reset(toDefaults(trainer));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trainer.id, trainer.updated_at]);

    const timerOn = form.watch('timer_enabled');

    const mutation = useMutation({
        mutationFn: (values: SettingsValues) => {
            const payload: UpdateTrainer = {
                title: values.title.trim(),
                category_id: values.category_id,
                timer_enabled: values.timer_enabled,
                seconds_per_question: values.timer_enabled ? Number(values.seconds_per_question.trim()) : null,
                shuffle_questions: values.shuffle_questions,
                shuffle_answers: values.shuffle_answers,
                flashcards_enabled: values.flashcards_enabled,
                attempts_limit: Number((values.attempts_limit || '0').trim()),
                background_image: values.background_image,
                available_from: localInputToUnix(values.available_from),
                available_to: localInputToUnix(values.available_to),
                course_ids: values.courses.map((c) => c.id),
            };
            return updateTrainer(trainer.id, payload);
        },
        onSuccess: (updated) => {
            toast.success(t('save_success'));
            qc.setQueryData(['admin.trainers.detail', trainer.id], updated);
            qc.invalidateQueries({ queryKey: ['admin.trainers.detail', trainer.id] });
            qc.invalidateQueries({ queryKey: ['admin.trainers.list'], exact: false });
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='max-w-3xl'>
                <fieldset disabled={!canEdit} className='space-y-4'>
                    {/* ── Негізгі баптаулар ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='title'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('title_label')}</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder={t('title_placeholder')} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='category_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('category_label')}</FormLabel>
                                    <FormControl>
                                        <QuizCategoryPicker
                                            value={field.value ?? null}
                                            onChange={(id) => field.onChange(id)}
                                            placeholder={t('filter_category')}
                                            allowInlineCreate={false}
                                            disabled={!canEdit}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='attempts_limit'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('attempts_limit_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            inputMode='numeric'
                                            className='max-w-40'
                                            value={field.value ?? ''}
                                            onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                            onBlur={field.onBlur}
                                            ref={field.ref}
                                            name={field.name}
                                        />
                                    </FormControl>
                                    <FormDescription>{t('attempts_unlimited_hint')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </Card>

                    {/* ── Таймер ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='timer_enabled'
                            render={({ field }) => (
                                <FormItem className='flex items-center justify-between gap-4'>
                                    <div className='space-y-0.5'>
                                        <FormLabel>{t('timer_label')}</FormLabel>
                                        <FormDescription>{t('timer_hint')}</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {timerOn ? (
                            <FormField
                                control={form.control}
                                name='seconds_per_question'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('seconds_per_question')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                className='max-w-40'
                                                placeholder='30'
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ''))}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                name={field.name}
                                            />
                                        </FormControl>
                                        <FormDescription>{t('seconds_per_question_hint')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}
                    </Card>

                    {/* ── Тәртіп ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='shuffle_questions'
                            render={({ field }) => (
                                <FormItem className='flex items-center justify-between gap-4'>
                                    <FormLabel className='m-0'>{t('shuffle_questions_label')}</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='shuffle_answers'
                            render={({ field }) => (
                                <FormItem className='flex items-center justify-between gap-4'>
                                    <FormLabel className='m-0'>{t('shuffle_answers_label')}</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='flashcards_enabled'
                            render={({ field }) => (
                                <FormItem className='flex items-center justify-between gap-4'>
                                    <div className='space-y-0.5'>
                                        <FormLabel>{t('flashcards_label')}</FormLabel>
                                        <FormDescription>{t('flashcards_hint')}</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </Card>

                    {/* ── Қолжетімділік терезесі ── */}
                    <Card className='space-y-4 p-5'>
                        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='available_from'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('availability_from')}</FormLabel>
                                        <FormControl>
                                            <Input type='datetime-local' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='available_to'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('availability_to')}</FormLabel>
                                        <FormControl>
                                            <Input type='datetime-local' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormDescription>{t('availability_hint')}</FormDescription>
                    </Card>

                    {/* ── Курстар + фон ── */}
                    <Card className='space-y-4 p-5'>
                        <FormField
                            control={form.control}
                            name='courses'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('courses_label')}</FormLabel>
                                    <FormControl>
                                        <MultiCoursePicker value={field.value} onChange={field.onChange} disabled={!canEdit} />
                                    </FormControl>
                                    <FormDescription>{t('courses_hint')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='background_image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('background_label')}</FormLabel>
                                    <FormControl>
                                        <FileUploader
                                            kind='image'
                                            variant='inline'
                                            value={field.value}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange(null)}
                                            disabled={!canEdit}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </Card>

                    {canEdit ? (
                        <div className='flex justify-end gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => form.reset(toDefaults(trainer))}
                                disabled={mutation.isPending}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </div>
                    ) : null}
                </fieldset>
            </form>
        </Form>
    );
}
