'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { FileUploader } from '@/components/ui/file-uploader';
import { createStory, updateStory } from '@/lib/stories/api';
import type { StoryDetail, StoryStatus, StoryUpsertInput } from '@/lib/stories/types';
import { slugify, SLUG_REGEX } from '@/lib/courses/format';
import { cn } from '@/lib/utils';

/**
 * STY-01 — create + edit dialog for stories. Single component, two modes
 * (controlled by `mode` prop). RU+KZ tabs for translations; image/icon/video
 * uploads use the Phase 5 upload-token flow verbatim (D-05).
 *
 * react-hook-form + zod (D-21). Slug auto-fills from RU title via slugify until
 * the user touches the slug field manually (mirrors Phase 5 Plan 02 behavior).
 *
 * Submission: POST createStory / PATCH updateStory. On success: invalidate
 * ['admin.stories.list'] (exact:false) + close + toast.
 */
const upsertStorySchema = z.object({
    slug: z
        .string()
        .min(1)
        .max(255)
        .refine((v) => SLUG_REGEX.test(v), { message: 'slug_invalid_format' }),
    image: z.string().max(255).optional(),
    icon: z.string().max(255).optional(),
    video: z.string().max(255).optional(),
    status: z.enum(['pending', 'publish']),
    link_type: z.string().max(255).optional(),
    page_type: z.string().max(255).optional(),
    link: z.string().max(255).optional(),
    show_more_button: z.boolean(),
    // Строкой, а не числом: пустое поле должно означать «не задано», а
    // z.number() на пустой строке даёт NaN и невнятную ошибку валидации.
    video_duration: z
        .string()
        .max(6)
        .refine((v) => v === '' || /^[1-9]\d*$/.test(v), { message: 'video_duration_invalid' })
        .optional(),
    title: z.string().min(1).max(255),
    description: z.string().max(2000),
    content: z.string().max(50000),
})
    // Кнопка без адреса ведёт в никуда — не даём сохранить такое.
    .refine((v) => !v.show_more_button || (v.link ?? '').trim().length > 0, {
        path: ['link'],
        message: 'link_required_for_button',
    });

type UpsertStoryValues = z.infer<typeof upsertStorySchema>;

export interface UpsertStoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog is in edit mode. Null/undefined = create mode. */
    story?: StoryDetail | null;
}

function defaultValues(story: StoryDetail | null | undefined): UpsertStoryValues {
    const kz = story?.translations?.find((t) => t.locale === 'kz');
    return {
        slug: story?.slug ?? '',
        image: story?.image ?? '',
        icon: story?.icon ?? '',
        video: story?.video ?? '',
        status: (story?.status as StoryStatus) ?? 'pending',
        link_type: story?.link_type ?? '',
        page_type: story?.page_type ?? '',
        link: story?.link ?? '',
        show_more_button: story?.show_more_button ?? false,
        video_duration: story?.video_duration == null ? '' : String(story.video_duration),
        title: kz?.title ?? '',
        description: kz?.description ?? '',
        content: kz?.content ?? '',
    };
}

export function UpsertStoryDialog({ open, onOpenChange, story }: UpsertStoryDialogProps) {
    const t = useTranslations('admin.stories');
    const qc = useQueryClient();
    const isEdit = !!story?.id;

    const [slugTouched, setSlugTouched] = useState(false);

    const form = useForm<UpsertStoryValues>({
        resolver: zodResolver(upsertStorySchema),
        defaultValues: defaultValues(story),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset(defaultValues(story));
            setSlugTouched(!!isEdit);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, story?.id]);

    const title = form.watch('title');
    useEffect(() => {
        if (!slugTouched) {
            form.setValue('slug', slugify(title ?? ''), { shouldValidate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, slugTouched]);

    const buildPayload = (values: UpsertStoryValues): StoryUpsertInput => ({
        slug: values.slug,
        image: values.image || null,
        icon: values.icon || null,
        video: values.video || null,
        status: values.status,
        link_type: values.link_type || null,
        page_type: values.page_type || null,
        link: values.link || null,
        show_more_button: values.show_more_button,
        video_duration: values.video_duration ? Number(values.video_duration) : null,
        translations: [
            {
                locale: 'kz',
                title: values.title,
                description: values.description ?? '',
                content: values.content ?? '',
            },
        ],
    });

    const mutation = useMutation({
        mutationFn: (values: UpsertStoryValues) => {
            const payload = buildPayload(values);
            return isEdit ? updateStory(story!.id, payload) : createStory(payload);
        },
        onSuccess: (saved) => {
            toast.success(isEdit ? t('updated_toast') : t('created_toast'));
            qc.invalidateQueries({ queryKey: ['admin.stories.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.stories.detail', saved.id], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    // Upload UX is now owned by <FileUploader> (kind-aware validation, progress,
    // toasts, abort) — see the FormField renders below for image / icon / video.

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-3xl'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('edit_title') : t('create_title')}</DialogTitle>
                    <DialogDescription>{t('list_subtitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='slug'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('slug_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t('slug_placeholder')}
                                            {...field}
                                            onChange={(e) => {
                                                setSlugTouched(true);
                                                field.onChange(e.target.value);
                                            }}
                                        />
                                    </FormControl>
                                    <p className='text-xs text-muted-foreground'>
                                        {t('slug_auto_help')}
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Одна колонка: рядом со статусом стояло поле
                            «Пікірлерге рұқсат», убранное по просьбе заказчика. */}
                        <div className='grid grid-cols-1 gap-3'>
                            <FormField
                                control={form.control}
                                name='status'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('status_label')}</FormLabel>
                                        <FormControl>
                                            <div
                                                role='radiogroup'
                                                className='inline-flex w-full rounded-md border bg-muted/30 p-1'
                                            >
                                                {(['pending', 'publish'] as const).map((opt) => (
                                                    <button
                                                        key={opt}
                                                        type='button'
                                                        role='radio'
                                                        aria-checked={field.value === opt}
                                                        onClick={() => field.onChange(opt)}
                                                        className={cn(
                                                            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                                            field.value === opt
                                                                ? 'bg-background text-foreground shadow-sm'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        )}
                                                    >
                                                        {t(`status_${opt}`)}
                                                    </button>
                                                ))}
                                            </div>
                                        </FormControl>
                                        <p className='text-xs text-muted-foreground'>
                                            {t(
                                                field.value === 'publish'
                                                    ? 'status_hint_publish'
                                                    : 'status_hint_pending'
                                            )}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-1 gap-3'>
                            <FormField
                                control={form.control}
                                name='image'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('image_label')}</FormLabel>
                                        <FileUploader
                                            kind='image'
                                            variant='inline'
                                            previewSize='md'
                                            value={field.value ?? ''}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange('')}
                                            pickFromLibrary
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='icon'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('icon_label')}</FormLabel>
                                        <FileUploader
                                            kind='image'
                                            variant='inline'
                                            previewSize='sm'
                                            value={field.value ?? ''}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange('')}
                                            pickFromLibrary
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='video'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('video_label')}</FormLabel>
                                        <FileUploader
                                            kind='video'
                                            variant='inline'
                                            previewSize='md'
                                            value={field.value ?? ''}
                                            onChange={(url) => field.onChange(url)}
                                            onClear={() => field.onChange('')}
                                            pickFromLibrary
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {/* Длительность вводится руками: считать её на
                                сервере нечем (ffprobe в образах нет), а из
                                браузера не выйдет для видео, выбранного из
                                библиотеки — локального файла у формы нет. */}
                            <FormField
                                control={form.control}
                                name='video_duration'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('video_duration_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                placeholder={t('video_duration_placeholder')}
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(e.target.value.replace(/[^\d]/g, ''))
                                                }
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                            />
                                        </FormControl>
                                        <p className='text-muted-foreground text-xs'>
                                            {t('video_duration_help')}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Кнопка перехода. Галочка и адрес идут парой: кнопка
                            без адреса ведёт в никуда, поэтому схема формы такое
                            сочетание не пропускает. */}
                        <div className='space-y-3 rounded border p-3'>
                            <FormField
                                control={form.control}
                                name='show_more_button'
                                render={({ field }) => (
                                    <FormItem className='flex flex-row items-center gap-2 space-y-0'>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(v) => field.onChange(!!v)}
                                            />
                                        </FormControl>
                                        <FormLabel className='!mt-0 cursor-pointer'>
                                            {t('show_more_button_label')}
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='link'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('link_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t('link_placeholder')}
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='space-y-3'>
                            <FormField
                                control={form.control}
                                name='title'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('title_kz_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t('title_kz_placeholder')}
                                                {...field}
                                            />
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
                                        <FormLabel>{t('description_kz_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea rows={2} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='content'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('content_kz_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea rows={8} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

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
                                {mutation.isPending ? t('saving') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
