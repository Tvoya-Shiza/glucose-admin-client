'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertSchedule } from '@/lib/courses/api';
import type { ScheduleRow } from '@/lib/courses/types';

/**
 * ScheduleRowForm — create / edit one WebinarChapterSchedule (Plan 06).
 *
 * react-hook-form + zod. Date inputs accept native <input type="datetime-local">
 * values (local-time strings) and convert to/from Unix seconds at the boundary.
 * The class-level zod refinement enforces end_date >= start_date.
 *
 * In create mode, group_id is taken from the URL state via the parent component;
 * the form receives it as a fixed prop (read-only label, no input). webinar_chapter_item_id
 * is a free numeric input — Phase 5 ships no inline item-picker; the admin/teacher
 * locates the item id in the Content tab. Future polish: a real chapter+item picker
 * dropdown that reads the course's tree.
 *
 * On 409 conflict (duplicate (group_id, item_id)): toast `schedule_conflict_409` —
 * the server-side find-then-create gate (CoursesScheduleService.create) maps to
 * this i18n key.
 */

const schema = z
    .object({
        webinar_chapter_item_id: z
            .number({ message: 'schedule_item_id_required' })
            .int()
            .min(1, 'schedule_item_id_required'),
        start_date: z.number().int().min(0),
        end_date: z.number().int().min(0),
        is_before_start: z.boolean(),
        expiration_check: z.boolean(),
    })
    .refine((d) => d.end_date >= d.start_date, {
        path: ['end_date'],
        message: 'schedule_end_before_start',
    });

type FormValues = z.infer<typeof schema>;

function unixToLocalInput(unix: number | null | undefined): string {
    if (typeof unix !== 'number' || unix <= 0) return '';
    const d = new Date(unix * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToUnix(s: string): number {
    if (!s) return 0;
    const d = new Date(s);
    if (isNaN(d.getTime())) return 0;
    return Math.floor(d.getTime() / 1000);
}

export interface ScheduleRowFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: number;
    groupId: number;
    /** When provided, dialog is in edit mode and seeds the form. */
    initial?: ScheduleRow | null;
}

export function ScheduleRowForm({
    open,
    onOpenChange,
    courseId,
    groupId,
    initial,
}: ScheduleRowFormProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    const isEdit = !!initial;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            webinar_chapter_item_id: initial?.webinar_chapter_item_id ?? 0,
            start_date: initial?.start_date ?? 0,
            end_date: initial?.end_date ?? 0,
            is_before_start: !!initial?.is_before_start,
            expiration_check: !!initial?.expiration_check,
        },
    });

    // Re-seed form when `initial` changes (re-opening dialog with a different row).
    useEffect(() => {
        if (open) {
            form.reset({
                webinar_chapter_item_id: initial?.webinar_chapter_item_id ?? 0,
                start_date: initial?.start_date ?? 0,
                end_date: initial?.end_date ?? 0,
                is_before_start: !!initial?.is_before_start,
                expiration_check: !!initial?.expiration_check,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initial?.id]);

    const mutation = useMutation({
        mutationFn: (values: FormValues) =>
            upsertSchedule(courseId, {
                id: initial?.id,
                webinar_chapter_item_id: values.webinar_chapter_item_id,
                group_id: groupId,
                start_date: values.start_date,
                end_date: values.end_date,
                is_before_start: values.is_before_start,
                expiration_check: values.expiration_check,
            }),
        onSuccess: () => {
            toast.success(t('schedule_saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.schedules', courseId, groupId] });
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
            onOpenChange(false);
        },
        onError: (err: Error) => {
            // 409 conflict: the wrapper's readErrorMessage surfaces the server's message.
            // The admin-api throws ConflictException('schedule.conflict'); we display the
            // localized 409 toast specifically when the message contains 'conflict'.
            const msg = err.message ?? '';
            if (msg.includes('conflict')) {
                toast.error(t('schedule_conflict_409'));
            } else {
                toast.error(msg || t('generic_error'));
            }
        },
    });

    const onSubmit = (values: FormValues) => {
        mutation.mutate(values);
    };

    const errs = form.formState.errors;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? t('schedule_form_title_edit') : t('schedule_form_title_create')}
                    </DialogTitle>
                    <DialogDescription>{t('schedule_pick_group_help')}</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-3'>
                    <div className='space-y-1'>
                        <Label htmlFor='schedule-item-id'>{t('schedule_field_item_id')}</Label>
                        <Input
                            id='schedule-item-id'
                            type='number'
                            min={1}
                            {...form.register('webinar_chapter_item_id', { valueAsNumber: true })}
                        />
                        <p className='text-muted-foreground text-xs'>
                            {t('schedule_field_item_id_help')}
                        </p>
                        {errs.webinar_chapter_item_id ? (
                            <p className='text-destructive text-xs'>
                                {t(errs.webinar_chapter_item_id.message ?? 'schedule_item_id_required')}
                            </p>
                        ) : null}
                    </div>

                    <div className='space-y-1'>
                        <Label htmlFor='schedule-start'>{t('schedule_field_start_date')}</Label>
                        <Input
                            id='schedule-start'
                            type='datetime-local'
                            defaultValue={unixToLocalInput(form.getValues('start_date'))}
                            onChange={(e) =>
                                form.setValue('start_date', localInputToUnix(e.target.value), {
                                    shouldValidate: true,
                                })
                            }
                        />
                    </div>

                    <div className='space-y-1'>
                        <Label htmlFor='schedule-end'>{t('schedule_field_end_date')}</Label>
                        <Input
                            id='schedule-end'
                            type='datetime-local'
                            defaultValue={unixToLocalInput(form.getValues('end_date'))}
                            onChange={(e) =>
                                form.setValue('end_date', localInputToUnix(e.target.value), {
                                    shouldValidate: true,
                                })
                            }
                        />
                        {errs.end_date ? (
                            <p className='text-destructive text-xs'>
                                {t(errs.end_date.message ?? 'schedule_end_before_start')}
                            </p>
                        ) : null}
                    </div>

                    <div className='flex items-center gap-2'>
                        <Checkbox
                            id='schedule-is-before-start'
                            checked={form.watch('is_before_start')}
                            onCheckedChange={(v) =>
                                form.setValue('is_before_start', v === true)
                            }
                        />
                        <Label htmlFor='schedule-is-before-start'>
                            {t('schedule_field_is_before_start')}
                        </Label>
                    </div>

                    <div className='flex items-center gap-2'>
                        <Checkbox
                            id='schedule-expiration-check'
                            checked={form.watch('expiration_check')}
                            onCheckedChange={(v) =>
                                form.setValue('expiration_check', v === true)
                            }
                        />
                        <Label htmlFor='schedule-expiration-check'>
                            {t('schedule_field_expiration_check')}
                        </Label>
                    </div>

                    <DialogFooter>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => onOpenChange(false)}
                        >
                            {t('cancel')}
                        </Button>
                        <Button type='submit' disabled={mutation.isPending}>
                            {mutation.isPending ? t('saving_dot') : t('save_schedule')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
