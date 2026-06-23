'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/access/use-me';
import { useIsSuper } from '@/lib/access/use-permission';
import { EntitySearchPicker } from '@/app/[locale]/(admin)/courses/[id]/components/entity-search-picker';
import { TiptapEditor } from '@/app/[locale]/(admin)/courses/[id]/components/tiptap-editor';
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
        // Phase 32 — scope discriminator. 'general' = no group (applies to all
        // students of the course); 'group' = scoped to the picked group.
        scope: z.enum(['general', 'group']),
        // Empty when scope='general'; a numeric-string group id when scope='group'.
        group_id: z.string(),
        // course_id is now required: the items picker is scoped to the schedule's
        // bound course on the backend (CoursesPickerItemsService), and admin-api
        // CreateScheduleDto rejects writes without it.
        course_id: z.string().min(1, 'field_course_required'),
        start_at_local: z.string().min(1, 'required'),
        end_at_local: z.string().min(1, 'required'),
        // Holds sanitized rich-text HTML — markup eats into the budget, so the
        // limit is higher than the old plain-text 2000 (DB column is TEXT; the
        // admin-api DTO caps the same way).
        description: z.string().max(10000),
        status: z.enum(SCHEDULE_STATUSES),
        // Phase 32 — independent access-gate toggles.
        block_before_start: z.boolean(),
        block_after_end: z.boolean(),
    })
    .refine((data) => data.scope === 'general' || data.group_id.trim().length > 0, {
        path: ['group_id'],
        message: 'group_required_when_specific',
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
    const hasGroup = editing?.group_id != null;
    return {
        curator_id: editing?.curator_id != null ? String(editing.curator_id) : fallbackCuratorId ? String(fallbackCuratorId) : '',
        // Existing general schedule → 'general'; existing group schedule or a new
        // schedule → 'group' (group remains the default to preserve current flow).
        scope: editing && !hasGroup ? 'general' : 'group',
        group_id: hasGroup ? String(editing!.group_id) : '',
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
        block_before_start: editing?.block_before_start ?? false,
        block_after_end: editing?.block_after_end ?? false,
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

    // When the user manually changes the course AFTER picking items, the old
    // items belong to a different course and would fail backend ref-validation
    // — prompt and clear. The ref starts null and is "primed" on dialog open
    // (effect above) so the initial defaultValues populating course_id doesn't
    // trip the confirmation.
    const prevCourseRef = useRef<number | null>(null);
    useEffect(() => {
        if (!open) return;
        if (prevCourseRef.current === null) {
            prevCourseRef.current = courseIdNum;
            return;
        }
        if (prevCourseRef.current === courseIdNum) return;
        if (items.length === 0) {
            prevCourseRef.current = courseIdNum;
            return;
        }
        const confirmed = window.confirm(t('change_course_warning'));
        if (confirmed) {
            setItems([]);
            prevCourseRef.current = courseIdNum;
        } else {
            // Revert the form value back to the previous course.
            form.setValue('course_id', prevCourseRef.current != null ? String(prevCourseRef.current) : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseIdNum, open]);

    // Reset the ref when the dialog closes so re-opening doesn't compare
    // against stale state from a previous session.
    useEffect(() => {
        if (!open) prevCourseRef.current = null;
    }, [open]);

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

            // Phase 32 — null group = general schedule.
            const group_id = values.scope === 'general' ? null : Number(values.group_id);

            if (isEdit && editing) {
                const payload: UpdateSchedulePayload = {
                    group_id,
                    course_id: Number(values.course_id),
                    start_at,
                    end_at,
                    description: values.description.length > 0 ? values.description : null,
                    status: values.status,
                    block_before_start: values.block_before_start,
                    block_after_end: values.block_after_end,
                    items: itemsPayload,
                };
                return updateSchedule(editing.id, payload);
            }

            const payload: CreateSchedulePayload = {
                curator_id: Number(values.curator_id),
                group_id,
                course_id: Number(values.course_id),
                start_at,
                end_at,
                description: values.description.length > 0 ? values.description : undefined,
                status: values.status,
                block_before_start: values.block_before_start,
                block_after_end: values.block_after_end,
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
                        {/* Course goes first — items editor is gated on it. */}
                        <FormField
                            control={form.control}
                            name='course_id'
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('field_course')}</FormLabel>
                                    <FormControl>
                                        <EntitySearchPicker
                                            kind='course'
                                            value={field.value}
                                            onChange={(v) => field.onChange(v)}
                                        />
                                    </FormControl>
                                    <p className='text-xs text-muted-foreground'>{t('field_course_required_hint')}</p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                        {/* Scope: General (no group) vs a specific group. */}
                                        <Controller
                                            control={form.control}
                                            name='scope'
                                            render={({ field: scopeField }) => (
                                                <div role='radiogroup' className='mb-2 inline-flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1'>
                                                    {(['general', 'group'] as const).map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type='button'
                                                            role='radio'
                                                            aria-checked={scopeField.value === opt}
                                                            onClick={() => {
                                                                scopeField.onChange(opt);
                                                                if (opt === 'general') field.onChange('');
                                                            }}
                                                            className={cn(
                                                                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                                                scopeField.value === opt
                                                                    ? 'bg-background text-foreground shadow-sm'
                                                                    : 'text-muted-foreground hover:text-foreground',
                                                            )}
                                                        >
                                                            {t(`scope_${opt}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        />
                                        {form.watch('scope') === 'group' && (
                                            <FormControl>
                                                <EntitySearchPicker
                                                    kind='user-group'
                                                    value={field.value}
                                                    onChange={(v) => field.onChange(v)}
                                                />
                                            </FormControl>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>


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

                        {/* Phase 32 — access-gate toggles. Off = informational event. */}
                        <div className='space-y-2 rounded-md border border-dashed p-3'>
                            <p className='text-xs text-muted-foreground'>{t('field_block_hint')}</p>
                            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                                <FormField
                                    control={form.control}
                                    name='block_before_start'
                                    render={({ field }) => (
                                        <FormItem className='flex items-center gap-2 space-y-0'>
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                                            </FormControl>
                                            <FormLabel className='!mt-0 font-normal'>{t('field_block_before_start')}</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='block_after_end'
                                    render={({ field }) => (
                                        <FormItem className='flex items-center gap-2 space-y-0'>
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                                            </FormControl>
                                            <FormLabel className='!mt-0 font-normal'>{t('field_block_after_end')}</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
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
                                        {/* Rich-text (Tiptap). Seed from the stable `editing` value so the
                                            editor's re-seed effect never fires mid-typing; `field.onChange`
                                            receives client-sanitized HTML on every edit. The key remounts the
                                            editor when switching between create and a specific schedule. */}
                                        <TiptapEditor
                                            key={editing?.id ?? 'create'}
                                            initialHtml={editing?.description ?? ''}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {courseIdNum != null ? (
                            <ScheduleItemsEditor value={items} onChange={setItems} courseId={courseIdNum} />
                        ) : (
                            <p className='rounded border border-dashed p-3 text-center text-xs text-muted-foreground'>
                                {t('select_course_first')}
                            </p>
                        )}

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
