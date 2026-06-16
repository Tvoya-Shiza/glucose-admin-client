'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { patchUserProfile } from '@/lib/users/api';
import { formatPhoneDisplay } from '@/lib/users/phone';
import type { UserDetail } from '@/lib/users/types';

/**
 * USR-03 (profile half) — edit-in-place per field with react-hook-form + zod (D-09).
 *
 * Validation strategy:
 *   - full_name: 1..255 chars (matches admin-api PatchUserProfileDto MinLength/MaxLength).
 *   - email: standard email + max 255.
 *   - mobile: relaxed regex that admits +7XXXXXXXXXX | 8XXXXXXXXXX | 7XXXXXXXXXX (D-24).
 *     Server-side normalizeKzPhone is the security gate; this is UX nicety.
 *   - about: free-form text (no length cap on the client; admin-api does its own).
 *
 * Optimistic UI: on submit we snapshot the previous detail in `onMutate`, replace the
 * cache on `onSuccess` with the server's authoritative response, and roll back on
 * `onError`. Role change is NOT here — Plan 04 owns RoleChangeDialog (D-11).
 */
const schema = z.object({
    full_name: z.string().min(1).max(255).optional(),
    email: z.string().email().max(255).optional(),
    mobile: z
        .string()
        .regex(/^(\+7\d{10}|8\d{10}|7\d{10})$/, 'phone_invalid')
        .optional(),
    about: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ProfileTab({ user }: { user: UserDetail }) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            full_name: user.full_name ?? '',
            email: user.email ?? '',
            mobile: user.mobile ?? '',
            about: user.about ?? '',
        },
    });

    const mutation = useMutation({
        mutationFn: (values: Values) => patchUserProfile(user.id, values),
        onMutate: () => {
            const prev = qc.getQueryData<UserDetail>(['admin.users.detail', String(user.id)]);
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            // Rollback optimistic update on server error (D-09).
            if (ctx?.prev) qc.setQueryData(['admin.users.detail', String(user.id)], ctx.prev);
            toast.error(t('save_failed'));
        },
        onSuccess: (next) => {
            qc.setQueryData(['admin.users.detail', String(user.id)], next);
            toast.success(t('saved'));
            setEditing(false);
        },
    });

    if (!editing) {
        return (
            <div className='space-y-3 pt-4'>
                <Field label={t('col_name')} value={user.full_name ?? '—'} />
                <Field label={t('col_email')} value={user.email ?? '—'} />
                <Field label={t('col_mobile')} value={formatPhoneDisplay(user.mobile) || '—'} />
                <Field label='About' value={user.about ?? '—'} />
                <Field label={t('col_role')} value={user.role_name} />
                <Field label={t('col_status')} value={user.status} />
                <Button onClick={() => setEditing(true)}>{t('edit')}</Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='space-y-3 pt-4'
        >
            <FormRow label={t('col_name')}>
                <Input {...form.register('full_name')} />
            </FormRow>
            <FormRow label={t('col_email')}>
                <Input type='email' {...form.register('email')} />
            </FormRow>
            <FormRow label={t('col_mobile')}>
                <Controller
                    control={form.control}
                    name='mobile'
                    render={({ field }) => (
                        <PhoneInput
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                        />
                    )}
                />
            </FormRow>
            <FormRow label='About'>
                <Input {...form.register('about')} />
            </FormRow>
            <div className='flex gap-2'>
                <Button type='submit' disabled={mutation.isPending}>
                    {mutation.isPending ? t('saving') : t('save')}
                </Button>
                <Button type='button' variant='outline' onClick={() => setEditing(false)}>
                    {t('cancel')}
                </Button>
            </div>
        </form>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <div className='text-muted-foreground'>{label}</div>
            <div className='col-span-2'>{value}</div>
        </div>
    );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='grid grid-cols-3 gap-2 text-sm'>
            <Label className='text-muted-foreground pt-2'>{label}</Label>
            <div className='col-span-2'>{children}</div>
        </div>
    );
}
