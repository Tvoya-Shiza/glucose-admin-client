'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

type LoginValues = z.infer<typeof loginSchema>;

// Whitelist of upstream status keys we map to localized toasts. Anything else
// collapses to 'incorrect' to avoid leaking server-side detail.
const KNOWN_AUTH_STATUSES = ['incorrect', 'ambiguous', 'not_staff', 'unauthorized', 'upstream_error'] as const;
type KnownAuthStatus = (typeof KNOWN_AUTH_STATUSES)[number];

export function LoginForm() {
    const t = useTranslations('login');
    const tAuth = useTranslations('admin.auth');
    const router = useRouter();
    const searchParams = useSearchParams();
    const locale = useLocale();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
        mode: 'onSubmit',
    });

    const onSubmit = async (values: LoginValues) => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const json = (await res.json().catch(() => null)) as { success?: boolean; status?: string; message?: string } | null;

            if (res.ok && json?.success) {
                toast.success(tAuth('login'));
                // Open-redirect mitigation (T-02-36): only allow same-origin paths.
                const next = searchParams.get('next');
                const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : `/${locale}/dashboard`;
                router.replace(safeNext);
                return;
            }

            const status = json?.status ?? 'incorrect';
            const key: KnownAuthStatus = (KNOWN_AUTH_STATUSES as readonly string[]).includes(status)
                ? (status as KnownAuthStatus)
                : 'incorrect';
            toast.error(tAuth(key));
        } catch {
            toast.error(tAuth('upstream_error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                <FormField
                    control={form.control}
                    name='email'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('email_label')}</FormLabel>
                            <FormControl>
                                <Input type='email' autoComplete='email' placeholder={t('email_placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name='password'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('password_label')}</FormLabel>
                            <FormControl>
                                <Input
                                    type='password'
                                    autoComplete='current-password'
                                    placeholder={t('password_placeholder')}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type='submit' className='w-full' disabled={submitting}>
                    {submitting ? t('submitting') : t('submit')}
                </Button>
            </form>
        </Form>
    );
}
