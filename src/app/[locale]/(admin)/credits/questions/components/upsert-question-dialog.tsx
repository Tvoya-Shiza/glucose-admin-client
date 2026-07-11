'use client';

import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FileUploader } from '@/components/ui/file-uploader';
import { TiptapEditor } from '@/app/[locale]/(admin)/courses/[id]/components/tiptap-editor';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoursePicker } from '@/components/courses/course-picker';
import { createCreditQuestion, listCreditTopics, updateCreditQuestion } from '@/lib/credits/api';
import { getCourse } from '@/lib/courses/api';
import { chapterDisplayTitle, chapterItemDisplayTitle } from '@/lib/credits/format';
import { buildCreditTopicTree, flattenCreditTopicTree } from '@/lib/credits/topic-tree';
import type { CreditDifficulty, CreditQuestionRow } from '@/lib/credits/types';

export interface UpsertQuestionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null → create; row → edit. */
    initial: CreditQuestionRow | null;
    /** Pre-selected custom topic for creates (e.g. the active topic filter). */
    defaultTopicId?: string | null;
}

// The single «Тақырып» select carries a discriminated value: a course lesson
// (`lesson:<chapter_item_id>`) or a custom topic (`topic:<topic_id>`). The
// server takes either `chapter_item_id` or `topic_id` — never both.
const LESSON_PREFIX = 'lesson:';
const TOPIC_PREFIX = 'topic:';

function buildSchema(t: (key: string) => string) {
    return z.object({
        // course_id / chapter_id only drive the lesson list; the `target` is the
        // actual tag, so these stay nullable (a custom topic needs neither).
        course_id: z.number().int().nullable(),
        chapter_id: z.number().int().nullable(),
        target: z.string().refine((v): boolean => v !== '', { message: t('validation_required') }),
        difficulty: z.enum(['A', 'B', 'C']),
        question: z.string().min(1, t('validation_required')),
        answer: z.string().min(1, t('validation_required')),
        question_image: z.string(),
        answer_image: z.string(),
        score: z.number().int(t('validation_number')).min(1, t('validation_number')),
    });
}

type Values = z.infer<ReturnType<typeof buildSchema>>;

/** Create/edit a bank question (RHF + zod). Tag = a course lesson or a custom topic. */
export function UpsertQuestionDialog({ open, onOpenChange, initial, defaultTopicId }: UpsertQuestionDialogProps) {
    const t = useTranslations('admin.credit_questions');
    const qc = useQueryClient();

    const schema = useMemo(() => buildSchema(t), [t]);

    const emptyValues: Values = {
        course_id: null,
        chapter_id: null,
        target: defaultTopicId ? `${TOPIC_PREFIX}${defaultTopicId}` : '',
        difficulty: 'A',
        question: '',
        answer: '',
        question_image: '',
        answer_image: '',
        score: 1,
    };

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: emptyValues,
        mode: 'onSubmit',
    });

    const courseId = form.watch('course_id');
    const chapterId = form.watch('chapter_id');
    const target = form.watch('target');

    // Custom topics («Тақырыптар» group) — lesson-backed topics are excluded;
    // those surface as real lessons under the selected module instead.
    const { data: topics = [] } = useQuery({
        queryKey: ['admin.credits.topics', { include_archived: false }],
        queryFn: () => listCreditTopics(false),
        staleTime: 30_000,
        enabled: open,
    });
    const customFlat = useMemo(
        () => flattenCreditTopicTree(buildCreditTopicTree(topics.filter((tp) => tp.chapter_item_id == null))),
        [topics]
    );

    const courseDetail = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId as number),
        enabled: open && courseId != null,
        staleTime: 60_000,
    });
    const chapters = useMemo(() => courseDetail.data?.chapters ?? [], [courseDetail.data]);
    const selectedChapter = useMemo(() => chapters.find((ch) => ch.id === chapterId) ?? null, [chapters, chapterId]);

    useEffect(() => {
        if (!open) return;
        if (initial) {
            const isLesson = initial.topic.chapter_item_id != null;
            form.reset({
                course_id: isLesson ? initial.topic.course_id : null,
                // Resolved by the effect below once the course structure loads.
                chapter_id: null,
                target: isLesson ? `${LESSON_PREFIX}${initial.topic.chapter_item_id}` : `${TOPIC_PREFIX}${initial.topic.id}`,
                difficulty: initial.difficulty,
                question: initial.question,
                answer: initial.answer,
                question_image: initial.question_image ?? '',
                answer_image: initial.answer_image ?? '',
                score: initial.score,
            });
        } else {
            form.reset({ ...emptyValues, target: defaultTopicId ? `${TOPIC_PREFIX}${defaultTopicId}` : '' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial]);

    // Editing a lesson-tagged question: once the course loads, select the module
    // that owns the lesson so the «Курс сабақтары» group renders the current value.
    useEffect(() => {
        if (!open || chapterId != null || !target.startsWith(LESSON_PREFIX)) return;
        const itemId = Number(target.slice(LESSON_PREFIX.length));
        const owner = chapters.find((ch) => ch.items.some((it) => it.id === itemId));
        if (owner) form.setValue('chapter_id', owner.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chapters, target, open]);

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const tag = values.target.startsWith(LESSON_PREFIX)
                ? { chapter_item_id: Number(values.target.slice(LESSON_PREFIX.length)) }
                : { topic_id: values.target.slice(TOPIC_PREFIX.length) };
            const payload = {
                ...tag,
                difficulty: values.difficulty as CreditDifficulty,
                question: values.question.trim(),
                answer: values.answer.trim(),
                question_image: values.question_image,
                answer_image: values.answer_image,
                score: values.score,
            };
            return initial ? updateCreditQuestion(initial.id, payload) : createCreditQuestion(payload);
        },
        onSuccess: () => {
            toast.success(initial ? t('updated_success') : t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.credit-questions.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.credits.topics'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{initial ? t('upsert_title_edit') : t('upsert_title_create')}</DialogTitle>
                    <DialogDescription>{t('upsert_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        {/* Course + module — optional pickers that populate the lesson group. */}
                        <div className='grid gap-3 sm:grid-cols-2'>
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
                                                    if (target.startsWith(LESSON_PREFIX)) form.setValue('target', '');
                                                }}
                                                placeholder={t('course_placeholder')}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='chapter_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('module_label')}</FormLabel>
                                        <Select
                                            value={field.value != null ? String(field.value) : ''}
                                            onValueChange={(v) => {
                                                field.onChange(Number(v));
                                                if (target.startsWith(LESSON_PREFIX)) form.setValue('target', '');
                                            }}
                                            disabled={courseId == null}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={courseId == null ? t('select_course_first') : t('module_placeholder')}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {chapters.length === 0 ? (
                                                    <div className='text-muted-foreground p-2 text-xs'>
                                                        {courseDetail.isFetching ? t('loading') : t('no_modules')}
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
                        </div>

                        {/* Тақырып (lessons of the module + custom topics) + difficulty. */}
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='target'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('topic_label')}</FormLabel>
                                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('topic_or_lesson_placeholder')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {selectedChapter && selectedChapter.items.length > 0 ? (
                                                    <SelectGroup>
                                                        <SelectLabel>{t('group_lessons')}</SelectLabel>
                                                        {selectedChapter.items.map((item) => (
                                                            <SelectItem key={`l${item.id}`} value={`${LESSON_PREFIX}${item.id}`}>
                                                                {chapterItemDisplayTitle(item)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ) : null}
                                                {customFlat.length > 0 ? (
                                                    <SelectGroup>
                                                        <SelectLabel>{t('group_topics')}</SelectLabel>
                                                        {customFlat.map(({ node, depth }) => (
                                                            <SelectItem key={`t${node.id}`} value={`${TOPIC_PREFIX}${node.id}`}>
                                                                {' '.repeat(depth * 3)}
                                                                {node.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ) : null}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='difficulty'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('difficulty_label')}</FormLabel>
                                        <FormControl>
                                            <ToggleGroup
                                                type='single'
                                                variant='outline'
                                                value={field.value}
                                                onValueChange={(v) => {
                                                    if (v) field.onChange(v);
                                                }}
                                            >
                                                <ToggleGroupItem value='A'>A</ToggleGroupItem>
                                                <ToggleGroupItem value='B'>B</ToggleGroupItem>
                                                <ToggleGroupItem value='C'>C</ToggleGroupItem>
                                            </ToggleGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Question — rich text (bold/italic/…) + optional photo. */}
                        <FormField
                            control={form.control}
                            name='question'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('question_label')}</FormLabel>
                                    <FormControl>
                                        <TiptapEditor initialHtml={initial?.question ?? ''} onChange={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='question_image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('question_image_label')}</FormLabel>
                                    <FormControl>
                                        <FileUploader
                                            kind='image'
                                            variant='thumb'
                                            previewSize='md'
                                            value={field.value || null}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange('')}
                                            pickFromLibrary
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Reference answer — rich text + optional photo (curator-only). */}
                        <FormField
                            control={form.control}
                            name='answer'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('answer_label')}</FormLabel>
                                    <FormControl>
                                        <TiptapEditor initialHtml={initial?.answer ?? ''} onChange={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='answer_image'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('answer_image_label')}</FormLabel>
                                    <FormControl>
                                        <FileUploader
                                            kind='image'
                                            variant='thumb'
                                            previewSize='md'
                                            value={field.value || null}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange('')}
                                            pickFromLibrary
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='score'
                            render={({ field }) => (
                                <FormItem className='max-w-40'>
                                    <FormLabel>{t('score_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type='number'
                                            min={1}
                                            value={field.value === 0 ? '' : field.value}
                                            onChange={(e) => {
                                                const n = Number(e.target.value);
                                                field.onChange(e.target.value === '' || !Number.isFinite(n) ? 0 : n);
                                            }}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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
