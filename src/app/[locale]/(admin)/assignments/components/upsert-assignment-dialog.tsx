'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createAssignment, getAssignment, updateAssignment } from '@/lib/assignments/api';
import type { AssignmentRow, CreateAssignmentPayload, UpdateAssignmentPayload } from '@/lib/assignments/types';

/**
 * Create / edit dialog for assignments.
 *
 * UX decisions (from product feedback):
 *   - KZ only. The site is single-locale; the RU/KZ tab toggle was removed.
 *   - No webinar/chapter inputs. Assignments are standalone "global" objects;
 *     the course binding is done from /kz/courses/<id>?tab=content (via the
 *     existing entity-search-picker → assignment row gets auto-back-filled
 *     by the server when first attached).
 *   - No deadline input. Course assignments are effectively open-ended in
 *     practice; the schema column stays nullable.
 */
interface UpsertAssignmentDialogProps {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    /** When non-null, the dialog is in edit mode for this row. */
    editing: AssignmentRow | null;
}

interface FormState {
    status: 'active' | 'inactive';
    attempts: string;
    grade: string;
    pass_grade: string;
    title: string;
    description: string;
}

const EMPTY_FORM: FormState = {
    status: 'active',
    attempts: '',
    grade: '',
    pass_grade: '',
    title: '',
    description: '',
};

function asNumber(s: string): number | undefined {
    if (s.trim().length === 0) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

export function UpsertAssignmentDialog({ open, onOpenChange, editing }: UpsertAssignmentDialogProps) {
    const t = useTranslations('admin.assignments');
    const qc = useQueryClient();

    const [form, setForm] = useState<FormState>(EMPTY_FORM);

    useEffect(() => {
        if (!open) {
            setForm(EMPTY_FORM);
            return;
        }
        if (!editing) {
            setForm(EMPTY_FORM);
            return;
        }
        setForm({
            status: editing.status,
            attempts: editing.attempts == null ? '' : String(editing.attempts),
            grade: editing.grade == null ? '' : String(editing.grade),
            pass_grade: editing.pass_grade == null ? '' : String(editing.pass_grade),
            title: editing.title_kz ?? '',
            description: '',
        });
        // Fetch the full detail to populate description (list row doesn't include it).
        let cancelled = false;
        getAssignment(editing.id)
            .then((detail) => {
                if (cancelled) return;
                const kz = detail.translations.find((x) => x.locale === 'kz');
                setForm((prev) => ({
                    ...prev,
                    title: kz?.title ?? prev.title,
                    description: kz?.description ?? '',
                }));
            })
            .catch(() => {
                /* silent — title from list row is already seeded */
            });
        return () => {
            cancelled = true;
        };
    }, [open, editing]);

    const mutation = useMutation({
        mutationFn: async () => {
            const title = form.title.trim();
            if (title.length === 0) {
                throw new Error(t('title_required'));
            }
            const translations = [{ locale: 'kz' as const, title, description: form.description }];

            if (editing) {
                const payload: UpdateAssignmentPayload = {
                    status: form.status,
                    attempts: asNumber(form.attempts),
                    grade: asNumber(form.grade),
                    pass_grade: asNumber(form.pass_grade),
                    translations,
                };
                await updateAssignment(editing.id, payload);
                return { mode: 'edit' as const };
            }

            const payload: CreateAssignmentPayload = {
                status: form.status,
                attempts: asNumber(form.attempts),
                grade: asNumber(form.grade),
                pass_grade: asNumber(form.pass_grade),
                translations,
            };
            await createAssignment(payload);
            return { mode: 'create' as const };
        },
        onSuccess: (res) => {
            toast.success(res.mode === 'create' ? t('created_success') : t('updated_success'));
            qc.invalidateQueries({ queryKey: ['admin.assignments.list'] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail'] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.analytics'] });
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(t('save_failed'), { description: e.message }),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-xl'>
                <DialogHeader>
                    <DialogTitle>{editing ? t('edit_dialog_title') : t('create_dialog_title')}</DialogTitle>
                </DialogHeader>

                <div className='space-y-4'>
                    <div className='space-y-1.5'>
                        <Label>{t('title_label')}</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder={t('title_placeholder')}
                        />
                    </div>

                    <div className='space-y-1.5'>
                        <Label>{t('description_label')}</Label>
                        <Textarea
                            rows={5}
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder={t('description_placeholder')}
                        />
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                            <Label>{t('status_label')}</Label>
                            <Select
                                value={form.status}
                                onValueChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-1.5'>
                            <Label>{t('attempts_label')}</Label>
                            <Input
                                type='number'
                                min={1}
                                value={form.attempts}
                                onChange={(e) => setForm({ ...form, attempts: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                            <Label>{t('grade_label')}</Label>
                            <Input
                                type='number'
                                min={0}
                                value={form.grade}
                                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label>{t('pass_grade_label')}</Label>
                            <Input
                                type='number'
                                min={0}
                                value={form.pass_grade}
                                onChange={(e) => setForm({ ...form, pass_grade: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button type='button' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? t('saving_dot') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
