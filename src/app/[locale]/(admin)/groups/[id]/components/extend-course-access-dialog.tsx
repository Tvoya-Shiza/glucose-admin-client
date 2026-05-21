'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { extendAccess } from '@/lib/course-access/api';

/**
 * Phase 18 — extend (or change expiry date for) an existing course-access grant.
 *
 * Reused for direct grants (Feature C, PR-5) — pass the same saleId from
 * either a group-grant row or a direct-grant row.
 *
 * Per the plan, the backend always overwrites access_days with a freshly
 * computed value (no additive "extend by N days" semantics). The "Perpetual"
 * checkbox sends `expires_at: null`; otherwise we pick the end-of-day local
 * timestamp from the date input.
 */
const schema = z
    .object({
        perpetual: z.boolean(),
        expires_date: z.string().optional(),
    })
    .refine((data) => data.perpetual || (!!data.expires_date && data.expires_date.length === 10), {
        message: 'date_required',
        path: ['expires_date'],
    });

type Values = z.infer<typeof schema>;

export interface ExtendCourseAccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    saleId: number;
    /** Used to seed the date input. Unix sec; null = perpetual. */
    currentExpiresAt: number | null;
    /** Optional title fragment (course title) for the dialog header. */
    courseTitle?: string | null;
    /** Optional invalidation key the table uses, so the row updates after success. */
    invalidateKey?: readonly unknown[];
}

function unixToIsoDate(unixSec: number | null): string {
    if (unixSec == null) return '';
    const d = new Date(unixSec * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function endOfDayUnix(isoDate: string | undefined): number | null {
    if (!isoDate || isoDate.length !== 10) return null;
    const parts = isoDate.split('-').map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, m, d] = parts as [number, number, number];
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Math.floor(dt.getTime() / 1000);
}

export function ExtendCourseAccessDialog({
    open,
    onOpenChange,
    saleId,
    currentExpiresAt,
    courseTitle,
    invalidateKey,
}: ExtendCourseAccessDialogProps) {
    const t = useTranslations('admin.course_access');
    const qc = useQueryClient();

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            perpetual: currentExpiresAt === null,
            expires_date: unixToIsoDate(currentExpiresAt),
        },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) {
            form.reset({
                perpetual: currentExpiresAt === null,
                expires_date: unixToIsoDate(currentExpiresAt),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, currentExpiresAt, saleId]);

    const mutation = useMutation({
        mutationFn: (values: Values) =>
            extendAccess(saleId, {
                expires_at: values.perpetual ? null : endOfDayUnix(values.expires_date),
            }),
        onSuccess: () => {
            if (invalidateKey) {
                qc.invalidateQueries({ queryKey: invalidateKey as unknown[], exact: false });
            }
            toast.success(t('extended_toast'));
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('expires_in_past')) toast.error(t('error_expires_in_past'));
            else if (msg.includes('already_revoked')) toast.error(t('error_already_revoked'));
            else if (msg.includes('sale_not_found') || msg.includes('404')) toast.error(t('error_sale_not_found'));
            else toast.error(t('error_generic'));
        },
    });

    const perpetualWatched = form.watch('perpetual');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('extend_dialog_title')}</DialogTitle>
                    <DialogDescription>{courseTitle ?? t('extend_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
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
                                {mutation.isPending ? t('loading') : t('extend')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
