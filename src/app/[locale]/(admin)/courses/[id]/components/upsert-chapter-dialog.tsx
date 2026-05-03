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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { upsertChapter } from '@/lib/courses/api';
import type { Chapter, ChapterStatus, Translation } from '@/lib/courses/types';

/**
 * UpsertChapterDialog — create or edit a WebinarChapter (CRS-03).
 *
 * Schema-truth note (Plan 01): WebinarChapterTranslation has TITLE only —
 * no description column. The form omits description; the API drops it server-side
 * for safety regardless.
 *
 * Form fields:
 *   - status: active | inactive
 *   - ru.title (required), kz.title (required) — at least RU is canonical (D-03);
 *     KZ required for parity per the milestone i18n posture.
 */
const chapterSchema = z.object({
    status: z.enum(['active', 'inactive']),
    ru: z.object({ title: z.string().min(1).max(255) }),
    kz: z.object({ title: z.string().min(1).max(255) }),
});

type ChapterFormValues = z.infer<typeof chapterSchema>;

export interface UpsertChapterDialogProps {
    courseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chapter?: Chapter | null;
}

function pickTitle(translations: Translation[] | undefined, locale: 'ru' | 'kz'): string {
    return translations?.find((t) => t.locale === locale)?.title ?? '';
}

export function UpsertChapterDialog({ courseId, open, onOpenChange, chapter }: UpsertChapterDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const isEdit = !!chapter;

    const form = useForm<ChapterFormValues>({
        resolver: zodResolver(chapterSchema),
        defaultValues: {
            status: (chapter?.status as ChapterStatus) ?? 'active',
            ru: { title: pickTitle(chapter?.translations, 'ru') },
            kz: { title: pickTitle(chapter?.translations, 'kz') },
        },
    });

    // Reset form when chapter changes (dialog re-opened on a different chapter).
    useEffect(() => {
        if (open) {
            form.reset({
                status: (chapter?.status as ChapterStatus) ?? 'active',
                ru: { title: pickTitle(chapter?.translations, 'ru') },
                kz: { title: pickTitle(chapter?.translations, 'kz') },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chapter?.id]);

    const mutation = useMutation({
        mutationFn: async (values: ChapterFormValues) => {
            return upsertChapter(courseId, {
                id: chapter?.id,
                status: values.status,
                translations: [
                    { locale: 'ru', title: values.ru.title },
                    { locale: 'kz', title: values.kz.title },
                ],
            });
        },
        onSuccess: () => {
            toast.success(t('saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
            qc.invalidateQueries({ queryKey: ['admin.courses.list'] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || t('save_failed'));
        },
    });

    const onSubmit = (values: ChapterFormValues) => {
        mutation.mutate(values);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? t('edit_chapter_dialog_title') : t('create_chapter_dialog_title')}
                    </DialogTitle>
                    <DialogDescription>{t('chapter_title_label')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='status'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('status_label')}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value='active'>{t('chapter_status_active')}</SelectItem>
                                            <SelectItem value='inactive'>{t('chapter_status_inactive')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Tabs defaultValue='ru'>
                            <TabsList>
                                <TabsTrigger value='ru'>{t('ru_translation')}</TabsTrigger>
                                <TabsTrigger value='kz'>{t('kz_translation')}</TabsTrigger>
                            </TabsList>
                            <TabsContent value='ru' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='ru.title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('chapter_title_label')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('chapter_title_placeholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                            <TabsContent value='kz' className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='kz.title'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('chapter_title_label')}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t('chapter_title_placeholder')} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>
                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving_dot') : t('save_chapter')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
