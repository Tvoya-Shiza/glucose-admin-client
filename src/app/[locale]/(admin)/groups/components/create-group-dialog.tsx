'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createGroup } from '@/lib/groups/api';
import type { GroupStatus } from '@/lib/groups/types';

// Schema kept simple — supervisor_id is a free-form numeric string here; we coerce + validate at
// submit time. Avoids the input/output-type mismatch that zod `.transform()` introduces with
// react-hook-form (resolver expects matching types in both directions).
const createGroupSchema = z.object({
    name: z.string().min(3).max(64),
    status: z.enum(['active', 'inactive']),
    supervisor_id: z
        .string()
        .optional()
        .refine(
            (v) => v == null || v.trim() === '' || (Number.isFinite(Number(v.trim())) && Number(v.trim()) > 0),
            { message: 'invalid_supervisor_id' },
        ),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;

export interface CreateGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * GRP-01 — admin-only single-row group creation dialog (D-09 + D-21).
 *
 * react-hook-form + zod (Phase 2 pattern). On success: invalidates
 * `['admin.groups.list']`, toast success, close dialog. On error: toast generic error
 * (admin-api 4xx envelopes are surfaced via the api wrapper's `.message` channel).
 *
 * No `<TypeTheCountConfirmation>` here — single-row creation has no >50 cascade gate.
 * Plain Confirm/Cancel.
 */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
    const t = useTranslations('admin.groups');
    const qc = useQueryClient();

    const form = useForm<CreateGroupValues>({
        resolver: zodResolver(createGroupSchema),
        defaultValues: { name: '', status: 'active', supervisor_id: '' },
        mode: 'onSubmit',
    });

    // Reset on close so re-open shows a fresh form.
    useEffect(() => {
        if (!open) form.reset({ name: '', status: 'active', supervisor_id: '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreateGroupValues) => {
            const supRaw = (values.supervisor_id ?? '').trim();
            const supParsed = supRaw === '' ? null : Number(supRaw);
            return createGroup({
                name: values.name,
                status: values.status as GroupStatus,
                supervisor_id:
                    typeof supParsed === 'number' && Number.isFinite(supParsed) && supParsed > 0
                        ? supParsed
                        : null,
            });
        },
        onSuccess: () => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('created_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                        className='space-y-4'
                    >
                        <FormField
                            control={form.control}
                            name='name'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('name_label')}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t('name_placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name='status'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('status_label')}</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('status_label')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value='active'>{t('status_active')}</SelectItem>
                                            <SelectItem value='inactive'>
                                                {t('status_inactive')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                {mutation.isPending ? t('loading') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
