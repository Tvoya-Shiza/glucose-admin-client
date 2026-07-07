'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { createCredit } from '@/lib/credits/api';
import { fromDatetimeLocal } from '@/lib/credits/format';
import type { CreateCreditPayload } from '@/lib/credits/types';
import { CREDIT_FORM_EMPTY, CreditFormFields, buildCreditFormSchema, type CreditFormValues } from './credit-form-fields';

export interface CreateCreditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Phase 34 — credit creation dialog (RHF + zod). On success navigates to the
 * detail page (mirrors CreateQuizDialog).
 */
export function CreateCreditDialog({ open, onOpenChange }: CreateCreditDialogProps) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const schema = useMemo(() => buildCreditFormSchema(t), [t]);

    const form = useForm<CreditFormValues>({
        resolver: zodResolver(schema),
        defaultValues: CREDIT_FORM_EMPTY,
        mode: 'onSubmit',
    });

    useEffect(() => {
        if (!open) form.reset(CREDIT_FORM_EMPTY);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mutation = useMutation({
        mutationFn: (values: CreditFormValues) => {
            const payload: CreateCreditPayload = {
                course_id: values.course_id as number,
                chapter_id: values.chapter_id as number,
                group_id: values.group_id as number,
                title: values.title.trim(),
                description: values.description.trim() !== '' ? values.description.trim() : undefined,
                scheduled_at: fromDatetimeLocal(values.scheduled_at),
                lesson_item_ids: values.lesson_item_ids,
            };
            return createCredit(payload);
        },
        onSuccess: (created) => {
            toast.success(t('created_success'));
            qc.invalidateQueries({ queryKey: ['admin.credits.list'], exact: false });
            onOpenChange(false);
            router.push(`/${locale}/credits/${created.id}`);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('create_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('create_dialog_description')}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className='space-y-4'>
                        <CreditFormFields form={form} />
                        <DialogFooter>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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
