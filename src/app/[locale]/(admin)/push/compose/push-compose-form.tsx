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
import type { AudienceShape } from '@/lib/audience/types';
import { broadcastPush, schedulePush, sendTestPushToMe } from '@/lib/push/api';
import type { NotificationCategory, PushPayload } from '@/lib/push/types';
import { SchedulePushDialog } from '../schedule/schedule-push-dialog';

/**
 * Phase 8 Plan 03 — Compose form (PSH-01, D-04 + D-05 + D-20).
 *
 * Flow:
 *   1. Admin fills RU+KZ title/body, picks category, optional deep_link.
 *   2. Admin selects audience via <AudienceSelector/>; <AudiencePreview/> renders
 *      server-computed count + sample with 30s cache (Plan 02).
 *   3. "Send test to me" → POST /push/test with payload only (no broadcast).
 *   4. "Broadcast" → opens confirm dialog requiring admin to type the audience
 *      count exactly (mirrors Phase 3 Plan 04 type-the-count pattern); on confirm,
 *      POST /push/broadcast.
 *
 * RBAC: this page is admin-only; curator/teacher are blocked by AdminNav (which
 * doesn't show /push for them — Plan 01 adminOnly flag) AND by admin-api
 * @Roles('admin'). If they reach here via direct URL, the broadcast/test calls
 * 403 and we surface a toast.
 */

const PAYLOAD_SCHEMA = z.object({
    title_kz: z.string().min(1).max(64),
    body_kz: z.string().min(1).max(240),
    category: z.enum(['info', 'promo', 'reminder', 'system']),
    deep_link: z.string().max(512).optional(),
});

const SCHEMA = z.object({
    payload: PAYLOAD_SCHEMA,
    // Audience filters validated server-side; client just enforces non-empty filters[].
    audience: z.object({
        filters: z.array(z.any()).min(1),
        exclude_no_fcm: z.boolean().optional(),
        exclude_no_email: z.boolean().optional(),
        exclude_unsubscribed: z.boolean().optional(),
    }),
});

type FormValues = z.infer<typeof SCHEMA>;

const CATEGORIES: NotificationCategory[] = ['info', 'promo', 'reminder', 'system'];

const DEFAULT_VALUES: FormValues = {
    payload: {
        title_kz: '',
        body_kz: '',
        category: 'info',
        deep_link: '',
    },
    audience: {
        filters: [],
        exclude_no_fcm: false,
        exclude_unsubscribed: false,
    },
};

export function PushComposeForm() {
    const t = useTranslations('admin.push');
    const tCommon = useTranslations('admin.audience');
    const qc = useQueryClient();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmCount, setConfirmCount] = useState('');
    const [scheduleOpen, setScheduleOpen] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(SCHEMA),
        defaultValues: DEFAULT_VALUES,
        mode: 'onChange',
    });

    const audience = form.watch('audience');
    const preview = useAudiencePreview(audience);
    const recipientCount = preview.data?.count ?? 0;

    const testMut = useMutation({
        mutationFn: (payload: PushPayload) => sendTestPushToMe({ payload }),
        onSuccess: (r) => {
            if (r.success) {
                toast.success(t('test_to_me_success'));
            } else {
                toast.error(`${t('test_to_me_failure')}${r.error ? `: ${r.error}` : ''}`);
            }
        },
        onError: (e) => toast.error(`${t('test_to_me_failure')}: ${(e as Error).message}`),
    });

    const scheduleMut = useMutation({
        mutationFn: (input: { payload: PushPayload; audience: AudienceShape; scheduled_at: number }) =>
            schedulePush(input),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.push.scheduled'] });
            toast.success(t('schedule_created'));
            setScheduleOpen(false);
            form.reset(DEFAULT_VALUES);
        },
        onError: (e) => toast.error(`${t('schedule_failed')}: ${(e as Error).message}`),
    });

    const broadcastMut = useMutation({
        mutationFn: (input: { payload: PushPayload; audience: AudienceShape }) => broadcastPush(input),
        onSuccess: (r) => {
            qc.invalidateQueries({ queryKey: ['admin.push.history'] });
            toast.success(
                `${t('broadcast_started')} — delivered=${r.delivered_count}, failed=${r.failed_count}, dedup=${r.duplicate_dedup_count}`,
            );
            setConfirmOpen(false);
            setConfirmCount('');
            form.reset(DEFAULT_VALUES);
        },
        onError: (e) => toast.error(`${t('broadcast_failed')}: ${(e as Error).message}`),
    });

    function onClickTest() {
        // Test endpoint only needs payload validation, not audience.
        const payloadOk = PAYLOAD_SCHEMA.safeParse(form.getValues('payload'));
        if (!payloadOk.success) {
            toast.error(t('required_field'));
            return;
        }
        testMut.mutate(form.getValues('payload'));
    }

    function onClickBroadcast() {
        if (!form.formState.isValid || recipientCount === 0) return;
        setConfirmCount('');
        setConfirmOpen(true);
    }

    function onConfirmBroadcast() {
        const expected = recipientCount;
        if (parseInt(confirmCount, 10) !== expected) {
            toast.error(t('broadcast_confirm_count_required'));
            return;
        }
        broadcastMut.mutate({
            payload: form.getValues('payload'),
            audience: form.getValues('audience'),
        });
    }

    return (
        <form
            onSubmit={(e) => e.preventDefault()}
            className='flex flex-col gap-6'
        >
            <h2 className='text-lg font-medium'>{t('compose_title')}</h2>

            {/* KZ title + body */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='title_kz'>{t('title_kz_label')}</Label>
                    <Input
                        id='title_kz'
                        maxLength={64}
                        {...form.register('payload.title_kz')}
                    />
                    <span className='text-muted-foreground text-xs'>{t('title_max_chars')}</span>
                </div>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='body_kz'>{t('body_kz_label')}</Label>
                    <Textarea
                        id='body_kz'
                        rows={3}
                        maxLength={240}
                        {...form.register('payload.body_kz')}
                    />
                    <span className='text-muted-foreground text-xs'>{t('body_max_chars')}</span>
                </div>
            </div>

            {/* Category + deep_link */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div className='flex flex-col gap-1'>
                    <Label>{t('category_label')}</Label>
                    <Controller
                        control={form.control}
                        name='payload.category'
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={(v) => field.onChange(v as NotificationCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {t(`category_${c}` as 'category_info')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className='flex flex-col gap-1'>
                    <Label htmlFor='deep_link'>{t('deep_link_label')}</Label>
                    <Input
                        id='deep_link'
                        placeholder={t('deep_link_placeholder')}
                        maxLength={512}
                        {...form.register('payload.deep_link')}
                    />
                </div>
            </div>

            {/* Audience */}
            <div className='flex flex-col gap-3'>
                <h3 className='text-sm font-medium'>{t('audience_section_title')}</h3>
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
                    variant='outline'
                    onClick={onClickTest}
                    disabled={testMut.isPending}
                >
                    {t('test_to_me_button')}
                </Button>
                <Button
                    type='button'
                    onClick={onClickBroadcast}
                    disabled={
                        !form.formState.isValid ||
                        preview.isLoading ||
                        recipientCount === 0 ||
                        broadcastMut.isPending
                    }
                >
                    {t('broadcast_button')}
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    onClick={() => setScheduleOpen(true)}
                    disabled={
                        !form.formState.isValid ||
                        preview.isLoading ||
                        recipientCount === 0 ||
                        scheduleMut.isPending
                    }
                >
                    {t('schedule_button')}
                </Button>
            </div>

            {/* Type-the-count confirm dialog */}
            <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmCount(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('broadcast_confirm_title')}</DialogTitle>
                    </DialogHeader>
                    <div className='flex flex-col gap-3'>
                        <p>{t('broadcast_confirm_body', { count: recipientCount })}</p>
                        <div className='flex flex-col gap-1'>
                            <Label htmlFor='confirm_count'>
                                {t('broadcast_confirm_count_label', { expected: recipientCount })}
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
                            disabled={broadcastMut.isPending}
                        >
                            {t('schedule_cancel')}
                        </Button>
                        <Button
                            onClick={onConfirmBroadcast}
                            disabled={broadcastMut.isPending}
                        >
                            {t('broadcast_button')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Plan 04 — Schedule date-time picker dialog (Asia/Almaty → UTC). */}
            <SchedulePushDialog
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                onConfirm={(scheduledAt) =>
                    scheduleMut.mutate({
                        payload: form.getValues('payload'),
                        audience: form.getValues('audience'),
                        scheduled_at: scheduledAt,
                    })
                }
                pending={scheduleMut.isPending}
            />

            {/* Hidden helper — keeps the audience-section title key referenced (avoids unused-import lint warnings). */}
            <span className='hidden'>{tCommon('preview_title')}</span>
        </form>
    );
}
