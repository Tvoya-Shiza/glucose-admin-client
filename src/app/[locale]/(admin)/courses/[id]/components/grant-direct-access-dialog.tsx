'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { UserPicker } from '@/components/users/user-picker';
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
import { grantUserAccess } from '@/lib/course-access/api';

/**
 * Phase 19 / Feature C — admin grants direct (per-user) course access from the
 * Accessors tab. Mirrors GrantCourseAccessDialog (group flavour) — same date /
 * perpetual UX, identical conflict messages.
 *
 * User picker scope: no role filter. The original `roles={['student']}` cut
 * out anyone whose role_name was anything else (staff, unset, etc.), which
 * silently broke the search whenever data didn't fit that single label.
 * `roles={[]}` runs one unfiltered listUsers call and surfaces the top match
 * regardless of role — admin-api still applies its own scope rules.
 */
const schema = z
    .object({
        user_id: z
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

export interface GrantDirectAccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: number;
}

function endOfDayUnix(isoDate: string | undefined): number | null {
    if (!isoDate || isoDate.length !== 10) return null;
    const parts = isoDate.split('-').map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts as [number, number, number];
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Math.floor(dt.getTime() / 1000);
}

export function GrantDirectAccessDialog({ open, onOpenChange, courseId }: GrantDirectAccessDialogProps) {
    const t = useTranslations('admin.course_access');
    const qc = useQueryClient();
    const [userLabel, setUserLabel] = useState<string | null>(null);

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { user_id: '', perpetual: false, expires_date: '' },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({ user_id: '', perpetual: false, expires_date: '' });
            setUserLabel(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: Values) =>
            grantUserAccess(Number(values.user_id), {
                webinar_id: courseId,
                expires_at: values.perpetual ? null : endOfDayUnix(values.expires_date),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.course-access.accessors', courseId], exact: false });
            toast.success(t('granted_toast'));
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('already_granted_to_user')) toast.error(t('error_already_granted_user'));
            else if (msg.includes('expires_in_past')) toast.error(t('error_expires_in_past'));
            else if (msg.includes('user_not_found')) toast.error(t('error_user_not_found'));
            else if (msg.includes('course_not_found')) toast.error(t('error_course_not_found'));
            else toast.error(t('error_generic'));
        },
    });

    const perpetualWatched = form.watch('perpetual');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('grant_direct_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('grant_direct_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='user_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_user')}</FormLabel>
                                    <FormControl>
                                        <UserPicker
                                            roles={[]}
                                            minQueryLength={0}
                                            value={field.value ? Number(field.value) : null}
                                            onChange={(id, row) => {
                                                field.onChange(id ? String(id) : '');
                                                setUserLabel(row?.full_name ?? row?.email ?? null);
                                            }}
                                            initialLabel={userLabel}
                                            placeholder={t('user_picker_placeholder')}
                                            disabled={mutation.isPending}
                                        />
                                    </FormControl>
                                    <FormDescription>{t('field_user_help')}</FormDescription>
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
                                            <Input type='date' {...field} disabled={mutation.isPending} />
                                        </FormControl>
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
