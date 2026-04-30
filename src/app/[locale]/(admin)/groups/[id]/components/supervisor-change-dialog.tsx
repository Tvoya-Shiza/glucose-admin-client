'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { changeSupervisor } from '@/lib/groups/api';
import type { GroupDetail } from '@/lib/groups/types';

/**
 * GRP-02 — admin-only supervisor change dialog (Plan 03, mirrors Phase 3 RoleChangeDialog).
 *
 * supervisor_id contract (per ChangeSupervisorDto):
 *   - 0 = clear assignment (mapped to null at admin-api service layer)
 *   - any positive int = User.id; admin-api validates target is staff (admin/curator).
 *
 * Schema kept simple — supervisor_id is a free-form numeric string here; we coerce +
 * validate at submit time. Avoids the input/output-type mismatch that zod `.transform()`
 * introduces with react-hook-form (resolver expects matching types in both directions),
 * matching the workaround documented in Plan 02 CreateGroupDialog.
 *
 * On success:
 *   - setQueryData(['admin.groups.detail', groupId], next) — page updates without a roundtrip
 *   - invalidateQueries(['admin.groups.list']) — list row refreshes if user navigates back
 *   - toast success, close dialog
 *
 * On error: toast the message channel (admin-api 4xx envelopes surface .message via the
 * api wrapper). 404 'groups.supervisor.not_found' surfaces as a localized "Куратор не найден".
 *
 * Future enhancement (deferred): replace numeric input with a curator-picker autocomplete.
 * For Plan 03, raw int input matches Plan 02's CreateGroupDialog supervisor_id field.
 */
const schema = z.object({
    supervisor_id: z
        .string()
        .refine(
            (v) => v.trim() === '0' || (v.trim() !== '' && Number.isFinite(Number(v.trim())) && Number(v.trim()) >= 0),
            { message: 'invalid_supervisor_id' },
        ),
    reason: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export interface SupervisorChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: GroupDetail;
    onChanged?: () => void;
}

export function SupervisorChangeDialog({ open, onOpenChange, group, onChanged }: SupervisorChangeDialogProps) {
    const t = useTranslations('admin.groups');
    const qc = useQueryClient();

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            supervisor_id: group.supervisor ? String(group.supervisor.id) : '',
            reason: '',
        },
        mode: 'onSubmit',
    });

    // Reset on open/close so re-open shows fresh state.
    useEffect(() => {
        if (open) {
            form.reset({
                supervisor_id: group.supervisor ? String(group.supervisor.id) : '',
                reason: '',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, group.supervisor?.id]);

    const mutation = useMutation({
        mutationFn: (values: Values) => {
            const raw = values.supervisor_id.trim();
            const parsed = Number(raw);
            return changeSupervisor(group.id, {
                supervisor_id: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                reason: values.reason?.trim() ? values.reason.trim() : undefined,
            });
        },
        onSuccess: (next) => {
            // The response carries previous_supervisor_id in addition to GroupDetail —
            // strip the audit-only field before caching so the cache shape stays a clean GroupDetail.
            const { ...rest } = next as GroupDetail & { previous_supervisor_id?: number | null };
            const detailOnly: GroupDetail = {
                id: rest.id,
                name: rest.name,
                status: rest.status,
                supervisor: rest.supervisor,
                creator: rest.creator,
                member_count: rest.member_count,
            };
            qc.setQueryData(['admin.groups.detail', group.id], detailOnly);
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            toast.success(t('saved') ?? 'Saved');
            onChanged?.();
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : '';
            // Surface dedicated copy for the "target user not found / not staff" case.
            if (msg.includes('groups.supervisor.not_found') || msg.includes('404')) {
                toast.error(t('supervisor_not_found'));
            } else {
                toast.error(t('error_generic'));
            }
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('supervisor_change_title')}</DialogTitle>
                    <DialogDescription>
                        {group.name} · {t('change_supervisor')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='supervisor_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('supervisor_id_label')}</FormLabel>
                                    <FormControl>
                                        <Input
                                            inputMode='numeric'
                                            placeholder={t('supervisor_id_placeholder')}
                                            value={field.value ?? ''}
                                            onChange={(e) =>
                                                field.onChange(e.target.value.replace(/[^\d]/g, ''))
                                            }
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                        />
                                    </FormControl>
                                    <FormDescription>{t('supervisor_input_help')}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='reason'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>reason</FormLabel>
                                    <FormControl>
                                        <Input maxLength={500} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                {mutation.isPending ? t('loading') : t('save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
