'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { CoursePicker } from '@/components/courses/course-picker';
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { grantGroupAccess } from '@/lib/course-access/api';

/**
 * Phase 18 — admin-only group → course access grant dialog.
 *
 * Form:
 *   - CoursePicker (status='active' — typical operator intent)
 *   - DatePicker for expires_at OR "perpetual" checkbox (Дата окончания / Бессрочно)
 *
 * On success:
 *   - invalidateQueries(['admin.course-access.group', groupId]) — table refreshes
 *   - toast success, close.
 *
 * 409 'already_granted_to_group' → localized "this group already has access" message.
 */
const schema = z
    .object({
        webinar_id: z
            .string()
            .min(1, 'required')
            .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, 'invalid'),
        perpetual: z.boolean(),
        expires_date: z.string().optional(),
    })
    .refine((data) => data.perpetual || (!!data.expires_date && data.expires_date.length === 10), {
        message: 'date_required',
        path: ['expires_date'],
    });

type Values = z.infer<typeof schema>;

export interface GrantCourseAccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: number;
}

/** End-of-day local time in unix sec for an ISO `YYYY-MM-DD` value. Returns null on empty/invalid. */
function endOfDayUnix(isoDate: string | undefined): number | null {
    if (!isoDate || isoDate.length !== 10) return null;
    const parts = isoDate.split('-').map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts as [number, number, number];
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Math.floor(dt.getTime() / 1000);
}

export function GrantCourseAccessDialog({ open, onOpenChange, groupId }: GrantCourseAccessDialogProps) {
    const t = useTranslations('admin.course_access');
    const qc = useQueryClient();
    const [courseLabel, setCourseLabel] = useState<string | null>(null);

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { webinar_id: '', perpetual: false, expires_date: '' },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({ webinar_id: '', perpetual: false, expires_date: '' });
            setCourseLabel(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: Values) =>
            grantGroupAccess(groupId, {
                webinar_id: Number(values.webinar_id),
                expires_at: values.perpetual ? null : endOfDayUnix(values.expires_date),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.course-access.group', groupId], exact: false });
            toast.success(t('granted_toast'));
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('already_granted_to_group')) {
                toast.error(t('error_already_granted'));
            } else if (msg.includes('expires_in_past')) {
                toast.error(t('error_expires_in_past'));
            } else if (msg.includes('course_not_found')) {
                toast.error(t('error_course_not_found'));
            } else {
                toast.error(t('error_generic'));
            }
        },
    });

    const perpetualWatched = form.watch('perpetual');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('grant_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('grant_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='webinar_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_course')}</FormLabel>
                                    <FormControl>
                                        <CoursePicker
                                            value={field.value ? Number(field.value) : null}
                                            onChange={(id, row) => {
                                                field.onChange(id ? String(id) : '');
                                                setCourseLabel(row?.title_kz ?? row?.slug ?? null);
                                            }}
                                            status='active'
                                            initialLabel={courseLabel}
                                            placeholder={t('course_picker_placeholder')}
                                            disabled={mutation.isPending}
                                        />
                                    </FormControl>
                                    <FormDescription>{t('field_course_help')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='perpetual'
                            render={({ field }) => (
                                <FormItem className='flex flex-row items-center gap-3 space-y-0'>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={(c) => field.onChange(c === true)}
                                            disabled={mutation.isPending}
                                        />
                                    </FormControl>
                                    <FormLabel className='!mt-0'>{t('field_perpetual')}</FormLabel>
                                </FormItem>
                            )}
                        />
                        {!perpetualWatched ? (
                            <FormField
                                control={form.control}
                                name='expires_date'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_expires_date')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type='date'
                                                {...field}
                                                disabled={mutation.isPending}
                                            />
                                        </FormControl>
                                        <FormDescription>{t('field_expires_date_help')}</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}
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
                                {mutation.isPending ? t('loading') : t('grant')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
