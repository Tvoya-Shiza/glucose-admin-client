'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AudiencePreview } from '@/components/audience/audience-preview';
import { AudienceSelector } from '@/components/audience/audience-selector';
import { useAudiencePreview } from '@/lib/audience/use-audience-preview';
import { sendMailing } from '@/lib/mailings/api';
import type { MailingCategory, MailingSendInput } from '@/lib/mailings/types';

/**
 * Phase 8 Plan 05 — Mailings compose form (PSH-05, D-14 + D-20).
 *
 * Mirrors PushComposeForm structure with mailing-specific fields. Differences:
 *   - Mailing payload is single-language (subject + html + optional text +
 *     category) — recipient mail clients render HTML; locale variants would
 *     need per-recipient render which is deferred to Phase 9+.
 *   - Server forces exclude_no_email=true regardless of client input.
 *   - Type-the-count confirm dialog mirrors push broadcast confirm.
 *   - When response carries smtp_unconfigured=true (typical dev with no SMTP
 *     env vars), the form displays a banner instead of a success toast and
 *     does NOT retry — the operator must configure SMTP and resend manually.
 *
 * RBAC: this page is admin-only; curator/teacher are blocked by AdminNav (Plan 01)
 * AND by admin-api @Roles('admin'). If they reach here via direct URL, the
 * sendMailing call 403s and we surface a toast.
 */

const SCHEMA = z.object({
    subject: z.string().min(1).max(255),
    html: z.string().min(1).max(100_000),
    text: z.string().max(100_000).optional().or(z.literal('')),
    category: z.enum(['marketing', 'transactional', 'reminder', 'system']),
    audience: z.object({
        filters: z.array(z.any()).min(1),
        exclude_no_fcm: z.boolean().optional(),
        exclude_no_email: z.boolean().optional(),
        exclude_unsubscribed: z.boolean().optional(),
    }),
});

type FormValues = z.infer<typeof SCHEMA>;

const CATEGORIES: MailingCategory[] = ['marketing', 'transactional', 'reminder', 'system'];

const DEFAULT_VALUES: FormValues = {
    subject: '',
    html: '',
    text: '',
    category: 'marketing',
    audience: {
        filters: [],
        exclude_unsubscribed: false,
    },
};

export function MailingsComposeForm() {
    const t = useTranslations('admin.mailings');
    const qc = useQueryClient();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmCount, setConfirmCount] = useState('');
    const [smtpWarning, setSmtpWarning] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(SCHEMA),
        defaultValues: DEFAULT_VALUES,
        mode: 'onChange',
    });

    const audience = form.watch('audience');
    const preview = useAudiencePreview(audience);
    const recipientCount = preview.data?.count ?? 0;

    const sendMut = useMutation({
        mutationFn: (input: MailingSendInput) => sendMailing(input),
        onSuccess: (r) => {
            qc.invalidateQueries({ queryKey: ['admin.mailings.history'] });
            if (r.smtp_unconfigured) {
                // SMTP env vars missing on the server. UI shows banner + does NOT retry.
                setSmtpWarning(true);
                setConfirmOpen(false);
                setConfirmCount('');
                return;
            }
            toast.success(
                `${t('send_started')} — delivered=${r.delivered_count}, failed=${r.failed_count}, dedup=${r.duplicate_dedup_count}`,
            );
            setConfirmOpen(false);
            setConfirmCount('');
            form.reset(DEFAULT_VALUES);
            setSmtpWarning(false);
        },
        onError: (e) => toast.error(`${t('send_failed')}: ${(e as Error).message}`),
    });

    function onClickSend() {
        if (!form.formState.isValid || recipientCount === 0) return;
        setConfirmCount('');
        setConfirmOpen(true);
        // Don't clear smtpWarning here — let it persist visually until next successful submit
        // so the operator notices the env-var miss.
    }

    function onConfirmSend() {
        const expected = recipientCount;
        if (parseInt(confirmCount, 10) !== expected) {
            toast.error(t('send_confirm_count_label', { expected }));
            return;
        }
        const v = form.getValues();
        sendMut.mutate({
            subject: v.subject,
            html: v.html,
            text: v.text && v.text.length > 0 ? v.text : undefined,
            category: v.category,
            audience: v.audience,
        });
    }

    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            className='flex flex-col gap-6'
        >
            <h2 className='text-lg font-medium'>{t('compose_title')}</h2>

            {smtpWarning && (
                <div
                    role='alert'
                    className='rounded-md border border-destructive bg-destructive/10 p-3 text-sm'
                >
                    {t('no_smtp_config_warning')}
                </div>
            )}

            {/* Subject + category */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='flex flex-col gap-1 md:col-span-1'>
                    <Label htmlFor='subject'>{t('subject_label')}</Label>
                    <Input
                        id='subject'
                        maxLength={255}
                        placeholder={t('subject_placeholder')}
                        {...form.register('subject')}
                    />
                </div>
                <div className='flex flex-col gap-1 md:col-span-1'>
                    <Label>{t('category_label')}</Label>
                    <Controller
                        control={form.control}
                        name='category'
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={(v) => field.onChange(v as MailingCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {t(`category_${c}` as 'category_marketing')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            {/* HTML body */}
            <div className='flex flex-col gap-1'>
                <Label htmlFor='body_html'>{t('body_html_label')}</Label>
                <Textarea
                    id='body_html'
                    rows={10}
                    maxLength={100_000}
                    {...form.register('html')}
                />
                <span className='text-muted-foreground text-xs'>{t('body_help')}</span>
            </div>

            {/* Optional plain-text fallback */}
            <div className='flex flex-col gap-1'>
                <Label htmlFor='body_text'>{t('body_text_label')}</Label>
                <Textarea
                    id='body_text'
                    rows={4}
                    maxLength={100_000}
                    {...form.register('text')}
                />
            </div>

            {/* Audience */}
            <div className='flex flex-col gap-3'>
                <Controller
                    control={form.control}
                    name='audience'
                    render={({ field }) => (
                        <AudienceSelector value={field.value} onChange={field.onChange} />
                    )}
                />
                <AudiencePreview audience={audience} />
            </div>

            {/* Actions */}
            <div className='flex flex-wrap gap-2'>
                <Button
                    type='button'
                    onClick={onClickSend}
                    disabled={
                        !form.formState.isValid ||
                        preview.isLoading ||
                        recipientCount === 0 ||
                        sendMut.isPending
                    }
                >
                    {t('send_button')}
                </Button>
            </div>

            {/* Type-the-count confirm dialog */}
            <Dialog
                open={confirmOpen}
                onOpenChange={(o) => {
                    setConfirmOpen(o);
                    if (!o) setConfirmCount('');
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('send_confirm_title')}</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-3'>
                        <p>{t('send_confirm_body', { count: recipientCount })}</p>
                        <div className='flex flex-col gap-1'>
                            <Label htmlFor='confirm_count'>
                                {t('send_confirm_count_label', { expected: recipientCount })}
                            </Label>
                            <Input
                                id='confirm_count'
                                inputMode='numeric'
                                value={confirmCount}
                                onChange={(e) => setConfirmCount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant='ghost'
                            onClick={() => {
                                setConfirmOpen(false);
                                setConfirmCount('');
                            }}
                            disabled={sendMut.isPending}
                        >
                            {t('history_filter_status_all')}
                        </Button>
                        <Button onClick={onConfirmSend} disabled={sendMut.isPending}>
                            {t('send_button')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
}
