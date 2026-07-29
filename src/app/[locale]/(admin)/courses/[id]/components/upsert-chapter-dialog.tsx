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
import { upsertChapter } from '@/lib/courses/api';
import type { Chapter, ChapterStatus, Translation } from '@/lib/courses/types';
import { usePermission } from '@/lib/access/use-permission';
import { MultiStudentPicker, type StudentChip } from '@/components/users/multi-student-picker';
import { GroupWhitelistField } from './group-whitelist-field';

/**
 * UpsertChapterDialog — create or edit a WebinarChapter (CRS-03).
 *
 * Schema-truth note (Plan 01): WebinarChapterTranslation has TITLE only —
 * no description column. The form omits description; the API drops it server-side
 * for safety regardless.
 */
const chapterSchema = z.object({
    status: z.enum(['active', 'inactive']),
    title: z.string().min(1).max(255),
});

type ChapterFormValues = z.infer<typeof chapterSchema>;

export interface UpsertChapterDialogProps {
    courseId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chapter?: Chapter | null;
}

function pickTitle(translations: Translation[] | undefined, locale: string): string {
    return translations?.find((t) => t.locale === locale)?.title ?? '';
}

export function UpsertChapterDialog({ courseId, open, onOpenChange, chapter }: UpsertChapterDialogProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const isEdit = !!chapter;

    // Phase 33 — module group whitelist (number[], empty = visible to all).
    const [allowedGroupIds, setAllowedGroupIds] = useState<number[]>(chapter?.allowed_group_ids ?? []);
    // Phase 44 — персональный доступ к разделу, наравне с уроком.
    const [allowedStudents, setAllowedStudents] = useState<StudentChip[]>(
        (chapter?.allowed_users ?? []).map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? null })),
    );
    const canEdit = usePermission('courses.edit');

    const form = useForm<ChapterFormValues>({
        resolver: zodResolver(chapterSchema),
        defaultValues: {
            status: (chapter?.status as ChapterStatus) ?? 'active',
            title: pickTitle(chapter?.translations, 'kz'),
        },
    });

    // Reset form when chapter changes (dialog re-opened on a different chapter).
    useEffect(() => {
        if (open) {
            form.reset({
                status: (chapter?.status as ChapterStatus) ?? 'active',
                title: pickTitle(chapter?.translations, 'kz'),
            });
            setAllowedGroupIds(chapter?.allowed_group_ids ?? []);
            setAllowedStudents((chapter?.allowed_users ?? []).map((u) => ({ id: u.id, label: u.full_name ?? u.email ?? null })));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, chapter?.id]);

    const mutation = useMutation({
        mutationFn: async (values: ChapterFormValues) => {
            return upsertChapter(courseId, {
                id: chapter?.id,
                status: values.status,
                translations: [{ locale: 'kz', title: values.title }],
                allowed_group_ids: allowedGroupIds,
                allowed_user_ids: allowedStudents.map((s) => s.id),
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
                        <FormField
                            control={form.control}
                            name='title'
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
                        {/* Phase 33/44 — доступ к разделу: группы и поимённо ученики. */}
                        <div className='bg-muted/30 space-y-3 rounded border p-3'>
                            <GroupWhitelistField value={allowedGroupIds} onChange={setAllowedGroupIds} disabled={!canEdit} />
                            <div className='space-y-1.5 border-t pt-3'>
                                <p className='text-sm font-medium'>{t('student_access_title')}</p>
                                <p className='text-muted-foreground text-xs'>{t('student_access_hint')}</p>
                                <MultiStudentPicker value={allowedStudents} onChange={setAllowedStudents} disabled={!canEdit} />
                            </div>
                        </div>
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
