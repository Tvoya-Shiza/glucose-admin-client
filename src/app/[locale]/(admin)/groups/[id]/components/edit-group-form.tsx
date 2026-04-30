'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateGroup } from '@/lib/groups/api';
import type { GroupDetail, GroupStatus } from '@/lib/groups/types';

/**
 * GRP-06 — inline edit form for group name + status.
 *
 * Mirrors the Phase 3 ProfileTab edit-in-place pattern (react-hook-form + zod with
 * optimistic-rollback mutation).
 *
 * Validation:
 *   - name: 3..64 chars (matches admin-api UpdateGroupDto + Plan 01 schema constraint)
 *   - status: enum('active','inactive')
 *
 * Cache strategy:
 *   - onMutate snapshots ['admin.groups.detail', groupId] for rollback
 *   - onSuccess setQueryData replaces detail cache with server's authoritative response
 *     AND invalidates ['admin.groups.list'] so the row refreshes if user navigates back
 *   - onError rolls back the snapshot
 *
 * Cache invalidation also covers Plan 02's geonline-admin:groups:* server-side cache
 * (admin-api invalidates on PATCH; this client just talks to the BFF).
 */
const schema = z.object({
    name: z.string().min(3).max(64),
    status: z.enum(['active', 'inactive']),
});
type Values = z.infer<typeof schema>;

export interface EditGroupFormProps {
    group: GroupDetail;
    onCancel: () => void;
    onSaved: () => void;
}

export function EditGroupForm({ group, onCancel, onSaved }: EditGroupFormProps) {
    const t = useTranslations('admin.groups');
    const qc = useQueryClient();

    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: group.name,
            status: group.status,
        },
        mode: 'onSubmit',
    });

    const mutation = useMutation({
        mutationFn: (values: Values) =>
            updateGroup(group.id, {
                name: values.name,
                status: values.status as GroupStatus,
            }),
        onMutate: () => {
            const prev = qc.getQueryData<GroupDetail>(['admin.groups.detail', group.id]);
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            // Rollback optimistic update on server error.
            if (ctx?.prev) qc.setQueryData(['admin.groups.detail', group.id], ctx.prev);
            toast.error(t('error_generic'));
        },
        onSuccess: (next) => {
            qc.setQueryData(['admin.groups.detail', group.id], next);
            qc.invalidateQueries({ queryKey: ['admin.groups.list'], exact: false });
            toast.success(t('saved') ?? 'Saved');
            onSaved();
        },
    });

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                className='space-y-4 pt-4'
            >
                <FormField
                    control={form.control}
                    name='name'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('name_label')}</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder={t('name_placeholder')} />
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
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className='flex gap-2'>
                    <Button type='submit' disabled={mutation.isPending}>
                        {mutation.isPending ? t('loading') : t('save')}
                    </Button>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={onCancel}
                        disabled={mutation.isPending}
                    >
                        {t('cancel')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
