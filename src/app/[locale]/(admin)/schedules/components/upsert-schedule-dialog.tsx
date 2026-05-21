'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/access/use-me';
import { useIsSuper } from '@/lib/access/use-permission';
import { EntitySearchPicker } from '@/app/[locale]/(admin)/courses/[id]/components/entity-search-picker';
import { createSchedule, updateSchedule } from '@/lib/schedules/api';
import {
    datetimeLocalToUnix,
    unixToDatetimeLocal,
} from '@/lib/schedules/format';
import {
    SCHEDULE_STATUSES,
    type CreateSchedulePayload,
    type Schedule,
    type ScheduleStatus,
    type UpdateSchedulePayload,
} from '@/lib/schedules/types';
import { ScheduleItemsEditor, type ScheduleItemDraft } from './schedule-items-editor';

const upsertScheduleSchema = z
    .object({
        curator_id: z.string().min(1, 'required'),
        group_id: z.string().min(1, 'required'),
        course_id: z.string(),
        start_at_local: z.string().min(1, 'required'),
        end_at_local: z.string().min(1, 'required'),
        description: z.string().max(2000),
        status: z.enum(SCHEDULE_STATUSES),
    })
    .refine(
        (data) => {
            const s = datetimeLocalToUnix(data.start_at_local);
            const e = datetimeLocalToUnix(data.end_at_local);
            return s != null && e != null && e > s;
        },
        { path: ['end_at_local'], message: 'invalid_range' },
    );

type UpsertScheduleValues = z.infer<typeof upsertScheduleSchema>;

interface UpsertScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: Schedule | null;
    /** Preselect course in the create form. Ignored when `editing` is set. */
    defaultCourseId?: number | null;
}

function defaultValues(
    editing: Schedule | null | undefined,
    fallbackCuratorId: number | null,
    fallbackCourseId: number | null,
): UpsertScheduleValues {
    return {
        curator_id: editing?.curator_id != null ? String(editing.curator_id) : fallbackCuratorId ? String(fallbackCuratorId) : '',
        group_id: editing?.group_id != null ? String(editing.group_id) : '',
        course_id:
            editing?.course_id != null
                ? String(editing.course_id)
                : fallbackCourseId != null
                  ? String(fallbackCourseId)
                  : '',
        start_at_local: unixToDatetimeLocal(editing?.start_at ?? Math.floor(Date.now() / 1000)),
        end_at_local: unixToDatetimeLocal(editing?.end_at ?? Math.floor(Date.now() / 1000) + 60 * 60),
        description: editing?.description ?? '',
        status: editing?.status ?? 'scheduled',
    };
}

export function UpsertScheduleDialog({ open, onOpenChange, editing, defaultCourseId }: UpsertScheduleDialogProps) {
    const t = useTranslations('admin.schedules');
    const qc = useQueryClient();
    const isEdit = !!editing?.id;
    const isSuper = useIsSuper();
    const { data: me } = useMe();
    const myId = me?.user_id ?? null;

    const fallbackCourseId = defaultCourseId ?? null;

    const form = useForm<UpsertScheduleValues>({
        resolver: zodResolver(upsertScheduleSchema),
        defaultValues: defaultValues(editing, myId, fallbackCourseId),
        mode: 'onSubmit',
    });

    const [items, setItems] = useState<ScheduleItemDraft[]>([]);

    useEffect(() => {
        if (open) {
            form.reset(defaultValues(editing, myId, fallbackCourseId));
            if (editing) {
                setItems(
                    editing.items.map((it, idx) => ({
                        _key: `existing-${it.id}`,
                        kind: it.kind,
                        ref_id: it.ref_id,
                        position: idx,
                        _title:
                            it.title_kz ?? it.title_ru ?? (it.resolved ? `#${it.ref_id}` : undefined),
                    })),
                );
            } else {
                setItems([]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editing?.id, myId, fallbackCourseId]);

    const courseIdStr = form.watch('course_id');
    const courseIdNum = courseIdStr && courseIdStr.length > 0 ? Number(courseIdStr) : null;

    const mutation = useMutation({
        mutationFn: async (values: UpsertScheduleValues) => {
            const start_at = datetimeLocalToUnix(values.start_at_local);
            const end_at = datetimeLocalToUnix(values.end_at_local);
            if (start_at == null || end_at == null) throw new Error('admin.schedules.invalid_range');

            const itemsPayload = items.map((it, idx) => ({
                kind: it.kind,
                ref_id: it.ref_id,
                position: idx,
            }));

            if (isEdit && editing) {
                const payload: UpdateSchedulePayload = {
                    group_id: Number(values.group_id),
                    course_id: values.course_id.length > 0 ? Number(values.course_id) : null,
                    start_at,
                    end_at,
                    description: values.description.length > 0 ? values.description : null,
                    status: values.status,
                    items: itemsPayload,
                };
                return updateSchedule(editing.id, payload);
            }

            const payload: CreateSchedulePayload = {
                curator_id: Number(values.curator_id),
                group_id: Number(values.group_id),
                course_id: values.course_id.length > 0 ? Number(values.course_id) : undefined,
                start_at,
                end_at,
                description: values.description.length > 0 ? values.description : undefined,
                status: values.status,
                items: itemsPayload,
            };
            return createSchedule(payload);
        },
        onSuccess: (saved) => {
            toast.success(isEdit ? t('updated_toast') : t('created_toast'));
            qc.invalidateQueries({ queryKey: ['admin.schedules.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.calendar'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.analytics'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.detail', saved.id], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(t(msg.replace(/^admin\.schedules\./, '')) || msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('edit_title') : t('create_title')}</DialogTitle>
                    <DialogDescription>{t('list_subtitle')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='curator_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_curator')}</FormLabel>
                                        <FormControl>
                                            {isEdit || !isSuper ? (
                                                <Input value={field.value} disabled readOnly />
                                            ) : (
                                                <EntitySearchPicker
                                                    kind='curator'
                                                    value={field.value}
                                                    onChange={(v) => field.onChange(v)}
                                                />
                                            )}
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name='group_id'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_group')}</FormLabel>
                                        <FormControl>
                                            <EntitySearchPicker
                                                kind='user-group'
                                                value={field.value}
                                                onChange={(v) => field.onChange(v)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='course_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_course_optional')}</FormLabel>
                                    <FormControl>
                                        <EntitySearchPicker
                                            kind='course'
                                            value={field.value}
                                            onChange={(v) => field.onChange(v)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                            <FormField
                                control={form.control}
                                name='start_at_local'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_start')}</FormLabel>
                                        <FormControl>
                                            <Input type='datetime-local' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name='end_at_local'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('field_end')}</FormLabel>
                                        <FormControl>
                                            <Input type='datetime-local' {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name='status'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_status')}</FormLabel>
                                    <FormControl>
                                        <div role='radiogroup' className='inline-flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1'>
                                            {SCHEDULE_STATUSES.map((opt) => (
                                                <button
                                                    key={opt}
                                                    type='button'
                                                    role='radio'
                                                    aria-checked={field.value === opt}
                                                    onClick={() => field.onChange(opt)}
                                                    className={cn(
                                                        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                                        field.value === opt
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground',
                                                    )}
                                                >
                                                    {t(`status_${opt}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name='description'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_description')}</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <ScheduleItemsEditor value={items} onChange={setItems} courseId={courseIdNum} />

                        <DialogFooter>
                            <Button type='button' variant='ghost' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button type='submit' disabled={mutation.isPending}>
                                {mutation.isPending ? t('saving') : isEdit ? t('save') : t('create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
