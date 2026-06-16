'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createUser } from '@/lib/users/api';

/**
 * Admin-only single-user creation dialog. Sister UI to the CSV import flow — that
 * surface is for batch onboarding, this surface for one-off operator creates.
 *
 * Field rules mirror admin-api `CreateUserDto`:
 *   - At least one of email / mobile is required (cross-field zod refine; admin-api
 *     re-validates and surfaces `users.email_or_mobile_required` if both are empty).
 *   - role_name is required (no default — admin should pick deliberately).
 *   - password is optional; empty → admin-api leaves the column NULL and the user
 *     authenticates via the SMS-code flow (parity with public student registration).
 *
 * On success: invalidate ['admin.users.list'] (any args) so the list refreshes,
 * toast, close, and navigate to the new user's detail page.
 */
const createUserSchema = z
    .object({
        full_name: z.string().max(255).optional(),
        email: z.string().email().max(255).optional().or(z.literal('')),
        mobile: z
            .string()
            .regex(/^\+7\d{10}$/, 'phone_invalid')
            .optional()
            .or(z.literal('')),
        password: z.string().min(6).max(72).optional().or(z.literal('')),
        role_name: z.enum(['admin', 'curator', 'teacher', 'student']),
        status: z.enum(['active', 'inactive', 'pending']),
    })
    .refine((v) => (v.email && v.email.length > 0) || (v.mobile && v.mobile.length > 0), {
        message: 'email_or_mobile_required',
        path: ['email'],
    });

type CreateUserValues = z.infer<typeof createUserSchema>;

export interface CreateUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
    const t = useTranslations('admin.users');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const form = useForm<CreateUserValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            full_name: '',
            email: '',
            mobile: '',
            password: '',
            role_name: 'student',
            status: 'active',
        },
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) {
            form.reset({
                full_name: '',
                email: '',
                mobile: '',
                password: '',
                role_name: 'student',
                status: 'active',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreateUserValues) =>
            createUser({
                full_name: values.full_name?.trim() || undefined,
                email: values.email?.trim() || undefined,
                mobile: values.mobile?.trim() || undefined,
                password: values.password?.trim() || undefined,
                role_name: values.role_name,
                status: values.status,
            }),
        onSuccess: (created) => {
            toast.success(t('create_success'));
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/users/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('create_error');
            // Map known backend codes to localized strings.
            if (msg.includes('users.email_taken')) toast.error(t('error_email_taken'));
            else if (msg.includes('users.mobile_taken')) toast.error(t('error_mobile_taken'));
            else if (msg.includes('users.email_or_mobile_required')) toast.error(t('error_email_or_mobile_required'));
            else if (msg.includes('users.mobile_invalid')) toast.error(t('error_mobile_invalid'));
            else toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <FormField
                            control={form.control}
                            name='full_name'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_full_name')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('field_full_name')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='email'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_email')}</FormLabel>
                                        <FormControl>
                                            <Input type='email' placeholder='user@example.com' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='mobile'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_mobile')}</FormLabel>
                                        <FormControl>
                                            <PhoneInput value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <FormField
                                control={form.control}
                                name='role_name'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('col_role')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='admin'>{t('role_admin')}</SelectItem>
                                                <SelectItem value='curator'>{t('role_curator')}</SelectItem>
                                                <SelectItem value='teacher'>{t('role_teacher')}</SelectItem>
                                                <SelectItem value='student'>{t('role_student')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='status'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('col_status')}</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value='active'>{t('status_active')}</SelectItem>
                                                <SelectItem value='pending'>{t('status_pending')}</SelectItem>
                                                <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='password'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_password')}</FormLabel>
                                    <FormControl>
                                        <Input type='password' autoComplete='new-password' {...field} />
                                    </FormControl>
                                    {/* <FormDescription>{t('field_password_helper')}</FormDescription> */}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                                {t('cancel_action')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('loading') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
