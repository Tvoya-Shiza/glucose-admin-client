'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { listCourses } from '@/lib/courses/api';
import {
    createPromocode,
    PromocodeApiError,
    updatePromocode,
} from '@/lib/promocodes/api';
import type {
    DiscountType,
    PromocodeApplicableTo,
    PromocodeDetail,
    PromocodeUpsertInput,
} from '@/lib/promocodes/types';

/**
 * PRM-01 — create + edit dialog for promocodes (Phase 7 Plan 05).
 *
 * Single component, two modes: edit when `promocode` prop is non-null, create
 * otherwise. react-hook-form + zod (D-21).
 *
 * Cross-field validation:
 *   - discount_value > 0 (and ≤ 100 when discount_type === 'percentage')
 *   - expires_at > start_date (T-07-05-03)
 *
 * applicable_to encoding (D-13 + Plan 01 schema-truth lock #5):
 *   - radio "global" → { type: 'global' }
 *   - radio "course" → { type: 'course', course_ids: number[] }
 *   - server normalizes course_ids out when type === 'global' (T-07-05-06)
 *
 * Code field is uppercased on type and validated against `^[A-Z0-9_-]+$`.
 *
 * 409 conflict handling: PromocodeApiError.code === 'code_already_exists' →
 * red toast (localized) + focus the code field.
 *
 * Submission: POST createPromocode / PATCH updatePromocode. On success:
 * invalidate ['admin.promocodes.list'] + ['admin.promocodes.detail', id], close,
 * toast.
 */

const upsertPromocodeSchema = z
    .object({
        code: z
            .string()
            .min(2)
            .max(255)
            .refine((v) => /^[A-Z0-9_-]+$/.test(v), { message: 'code_format_invalid' }),
        title: z.string().max(255).optional(),
        description: z.string().max(2000).optional(),
        discount_type: z.enum(['percentage', 'fixed']),
        discount_value: z
            .string()
            .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), { message: 'discount_value_format_invalid' })
            .refine((v) => Number(v) > 0, { message: 'discount_value_must_be_positive' }),
        max_discount_amount: z
            .string()
            .optional()
            .refine((v) => !v || /^\d{1,13}(\.\d{1,2})?$/.test(v), { message: 'amount_format_invalid' }),
        minimum_order_amount: z
            .string()
            .optional()
            .refine((v) => !v || /^\d{1,13}(\.\d{1,2})?$/.test(v), { message: 'amount_format_invalid' }),
        usage_limit: z
            .string()
            .optional()
            .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 1), {
                message: 'usage_limit_invalid',
            }),
        usage_limit_per_user: z
            .string()
            .optional()
            .refine((v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 1), {
                message: 'usage_limit_invalid',
            }),
        is_active: z.boolean(),
        // ISO date strings from <Input type="date"> — converted to unix seconds at submit.
        start_date: z.string().min(1),
        expires_at: z.string().min(1),
        applicable_to_type: z.enum(['global', 'course']),
        applicable_to_course_ids: z.array(z.number().int().positive()).optional(),
        first_purchase_only: z.boolean(),
    })
    .superRefine((data, ctx) => {
        // Cross-field: percentage capped at 100.
        if (data.discount_type === 'percentage' && Number(data.discount_value) > 100) {
            ctx.addIssue({
                path: ['discount_value'],
                code: z.ZodIssueCode.custom,
                message: 'form_validation_percentage_max',
            });
        }
        // Cross-field: expires_at > start_date.
        const start = new Date(data.start_date).getTime();
        const expires = new Date(data.expires_at).getTime();
        if (Number.isFinite(start) && Number.isFinite(expires) && expires <= start) {
            ctx.addIssue({
                path: ['expires_at'],
                code: z.ZodIssueCode.custom,
                message: 'form_validation_expires_after_start',
            });
        }
    });

type UpsertPromocodeValues = z.infer<typeof upsertPromocodeSchema>;

export interface UpsertPromocodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When provided, dialog is in edit mode. Null/undefined = create mode. */
    promocode?: PromocodeDetail | null;
}

function unixToIsoDate(unix: number): string {
    if (!Number.isFinite(unix) || unix <= 0) return '';
    const d = new Date(unix * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function isoDateToUnix(iso: string): number {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.floor(t / 1000);
}

function defaultValues(p: PromocodeDetail | null | undefined): UpsertPromocodeValues {
    const at = p?.applicable_to;
    return {
        code: p?.code ?? '',
        title: p?.title ?? '',
        description: p?.description ?? '',
        discount_type: (p?.discount_type as DiscountType) ?? 'percentage',
        discount_value: p?.discount_value ?? '0',
        max_discount_amount: p?.max_discount_amount ?? '',
        minimum_order_amount: p?.minimum_order_amount ?? '',
        usage_limit: p?.usage_limit != null ? String(p.usage_limit) : '',
        usage_limit_per_user: p?.usage_limit_per_user != null ? String(p.usage_limit_per_user) : '',
        is_active: p?.is_active ?? true,
        start_date: p?.start_date ? unixToIsoDate(p.start_date) : '',
        expires_at: p?.expires_at ? unixToIsoDate(p.expires_at) : '',
        applicable_to_type: at?.type === 'course' ? 'course' : 'global',
        applicable_to_course_ids: at?.type === 'course' ? at.course_ids : [],
        first_purchase_only: p?.first_purchase_only ?? false,
    };
}

export function UpsertPromocodeDialog({ open, onOpenChange, promocode }: UpsertPromocodeDialogProps) {
    const t = useTranslations('admin.promocodes');
    const qc = useQueryClient();
    const isEdit = !!promocode?.id;
    const codeRef = useRef<HTMLInputElement | null>(null);

    const courses = useQuery({
        queryKey: ['admin.courses.list', 'promocodes-picker'],
        queryFn: () => listCourses({ page: 1, page_size: 200 }),
        staleTime: 5 * 60 * 1000,
        enabled: open,
    });

    const form = useForm<UpsertPromocodeValues>({
        resolver: zodResolver(upsertPromocodeSchema),
        defaultValues: defaultValues(promocode),
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (open) form.reset(defaultValues(promocode));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, promocode?.id]);

    const buildPayload = (values: UpsertPromocodeValues): PromocodeUpsertInput => {
        const applicable_to: PromocodeApplicableTo =
            values.applicable_to_type === 'course'
                ? { type: 'course', course_ids: values.applicable_to_course_ids ?? [] }
                : { type: 'global' };
        return {
            code: values.code,
            title: values.title || null,
            description: values.description || null,
            discount_type: values.discount_type,
            discount_value: values.discount_value,
            max_discount_amount: values.max_discount_amount || null,
            minimum_order_amount: values.minimum_order_amount || null,
            usage_limit: values.usage_limit ? Number(values.usage_limit) : null,
            usage_limit_per_user: values.usage_limit_per_user
                ? Number(values.usage_limit_per_user)
                : null,
            is_active: values.is_active,
            start_date: isoDateToUnix(values.start_date),
            expires_at: isoDateToUnix(values.expires_at),
            applicable_to,
            first_purchase_only: values.first_purchase_only,
        };
    };

    const mutation = useMutation({
        mutationFn: (values: UpsertPromocodeValues) => {
            const payload = buildPayload(values);
            return isEdit ? updatePromocode(promocode!.id, payload) : createPromocode(payload);
        },
        onSuccess: (saved) => {
            toast.success(isEdit ? t('updated_toast') : t('created_toast'));
            qc.invalidateQueries({ queryKey: ['admin.promocodes.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.promocodes.detail', saved.id], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            // 409 — code collision (T-07-05-02). Server returns Nest's default
            // ConflictException body where `message === 'code_already_exists'`.
            if (err instanceof PromocodeApiError && err.httpStatus === 409 && err.code === 'code_already_exists') {
                toast.error(t('code_already_exists_toast'));
                form.setError('code', { type: 'server', message: 'code_already_exists' });
                codeRef.current?.focus();
                return;
            }
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    const watchedType = form.watch('applicable_to_type');
    const watchedDiscountType = form.watch('discount_type');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('edit_title') : t('create_title')}</DialogTitle>
                    <DialogDescription>{t('list_subtitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                        className='space-y-4'
                    >
                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='code'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_code_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder={t('form_code_placeholder')}
                                                {...field}
                                                ref={(el) => {
                                                    codeRef.current = el;
                                                    field.ref(el);
                                                }}
                                                onChange={(e) =>
                                                    field.onChange(e.target.value.toUpperCase())
                                                }
                                                disabled={isEdit}
                                            />
                                        </FormControl>
                                        <p className='text-xs text-muted-foreground'>
                                            {t('form_code_format_help')}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='title'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_title_label')}</FormLabel>
                                        <FormControl>
                                            <Input value={field.value ?? ''} onChange={field.onChange} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='description'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('form_description_label')}</FormLabel>
                                    <FormControl>
                                        <Textarea rows={2} value={field.value ?? ''} onChange={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='discount_type'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('discount_type_label')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='percentage'>
                                                    {t('form_discount_type_percentage')}
                                                </SelectItem>
                                                <SelectItem value='fixed'>
                                                    {t('form_discount_type_fixed')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='discount_value'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('form_discount_value_label')}{' '}
                                            <span className='text-muted-foreground'>
                                                ({watchedDiscountType === 'percentage' ? '%' : '₸'})
                                            </span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='decimal'
                                                placeholder='10'
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='max_discount_amount'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_max_discount_amount_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='decimal'
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='minimum_order_amount'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_minimum_order_amount_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='decimal'
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='usage_limit'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_usage_limit_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='usage_limit_per_user'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_usage_limit_per_user_label')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                inputMode='numeric'
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='start_date'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_start_date_label')}</FormLabel>
                                        <FormControl>
                                            <Input type='date' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='expires_at'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('form_expires_at_label')}</FormLabel>
                                        <FormControl>
                                            <Input type='date' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='space-y-2'>
                            <FormLabel>{t('applicable_to_label')}</FormLabel>
                            <FormField
                                control={form.control}
                                name='applicable_to_type'
                                render={({ field }) => (
                                    <FormItem>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='global'>
                                                    {t('form_applicable_global')}
                                                </SelectItem>
                                                <SelectItem value='course'>
                                                    {t('form_applicable_course')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {watchedType === 'course' ? (
                                <FormField
                                    control={form.control}
                                    name='applicable_to_course_ids'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className='text-xs text-muted-foreground'>
                                                {t('form_applicable_course_select')}
                                            </FormLabel>
                                            <div className='max-h-40 overflow-y-auto rounded border p-2 space-y-1'>
                                                {(courses.data?.rows ?? []).map((c) => {
                                                    const checked = (field.value ?? []).includes(c.id);
                                                    return (
                                                        <label
                                                            key={c.id}
                                                            className='flex items-center gap-2 text-sm'
                                                        >
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(v) => {
                                                                    const cur = field.value ?? [];
                                                                    if (v) {
                                                                        if (!cur.includes(c.id))
                                                                            field.onChange([...cur, c.id]);
                                                                    } else {
                                                                        field.onChange(cur.filter((x) => x !== c.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className='font-mono text-xs'>
                                                                #{c.id}
                                                            </span>
                                                            <span className='truncate'>{c.slug}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : null}
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='is_active'
                                render={({ field }) => (
                                    <FormItem className='flex items-center gap-2 space-y-0'>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(v) => field.onChange(!!v)}
                                            />
                                        </FormControl>
                                        <FormLabel className='!mt-0'>{t('form_is_active_label')}</FormLabel>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='first_purchase_only'
                                render={({ field }) => (
                                    <FormItem className='flex items-center gap-2 space-y-0'>
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(v) => field.onChange(!!v)}
                                            />
                                        </FormControl>
                                        <FormLabel className='!mt-0'>
                                            {t('form_first_purchase_only_label')}
                                        </FormLabel>
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
