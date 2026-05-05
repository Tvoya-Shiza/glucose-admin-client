'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { refundSale } from '@/lib/sales/api';
import type { SaleDetail } from '@/lib/sales/types';

/** PAY-03 / D-08 — type-the-count threshold (KZT). Above this the operator must
 *  type the Sale.id to arm Confirm. UX gate only; server has no knowledge of
 *  this threshold (T-09-03-08 — accepted risk per CONTEXT). */
export const REFUND_THRESHOLD_KZT = 50000;

/** Zod schema — refund_reason is the only required field; threshold gate is
 *  enforced via component state (TypeTheCountConfirmation own input + Submit
 *  flow), not via the schema (typed_id never leaves this component). */
const refundSchema = z.object({
    refund_reason: z.string().min(3).max(500),
});

type RefundValues = z.infer<typeof refundSchema>;

export interface RefundDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sale: Pick<SaleDetail, 'id' | 'amount' | 'total_amount' | 'refund_at'>;
}

/**
 * PAY-03 — sales refund dialog (Plan 03 Task 4).
 *
 * Two-pane flow:
 *   1. Default pane: refund_reason Textarea (rhf+zod, min 3, max 500). "Submit"
 *      either fires the mutation directly OR (if total_amount > 50000 KZT)
 *      reveals the TypeTheCountConfirmation gate.
 *   2. Threshold pane: TypeTheCountConfirmation requires the operator to type
 *      `String(sale.id)` to arm "Confirm". On confirm, the refund mutation fires
 *      with the same refund_reason from pane 1 (kept in component state).
 *
 * On success: invalidate `['admin.sales.detail', String(sale.id)]` and the list
 * query so the detail page + any open list page refetch with refund_at populated.
 *
 * Error handling:
 *   - 409 (`refund_already_refunded`): localized `admin.sales.refund_already_refunded`
 *     toast. The detail page should already show the refunded badge — closing the
 *     dialog and re-fetching corrects the optimistic state.
 *   - Other errors: localized `admin.sales.refund_failed` toast.
 *
 * Decimal-on-wire posture: `sale.total_amount` is a string. `Number(value)` for
 * the threshold check is safe (50_000 KZT << MAX_SAFE_INTEGER).
 */
export function RefundDialog({ open, onOpenChange, sale }: RefundDialogProps) {
    const t = useTranslations('admin.sales');
    const qc = useQueryClient();
    const [showThresholdGate, setShowThresholdGate] = useState(false);

    const form = useForm<RefundValues>({
        resolver: zodResolver(refundSchema),
        defaultValues: { refund_reason: '' },
    });

    // Reset local + form state when the dialog closes/reopens.
    useEffect(() => {
        if (open) {
            form.reset({ refund_reason: '' });
            setShowThresholdGate(false);
        }
    }, [open, sale.id, form]);

    const totalAmountNum = Number(sale.total_amount ?? sale.amount);
    const aboveThreshold = Number.isFinite(totalAmountNum) && totalAmountNum > REFUND_THRESHOLD_KZT;

    const mutate = useMutation({
        mutationFn: (refund_reason: string) => refundSale(sale.id, { refund_reason }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.sales.detail', String(sale.id)] });
            qc.invalidateQueries({ queryKey: ['admin.sales.list'], exact: false });
            toast.success(t('refund_success'));
            onOpenChange(false);
        },
        onError: (e: Error) => {
            if (e.message === 'refund_already_refunded') {
                qc.invalidateQueries({ queryKey: ['admin.sales.detail', String(sale.id)] });
                toast.error(t('refund_already_refunded'));
            } else {
                toast.error(t('refund_failed'));
            }
        },
    });

    const onSubmit = form.handleSubmit((values) => {
        if (aboveThreshold) {
            // Reveal the type-the-count gate. The reason value lives in the form
            // state; clicking the gate's Confirm button fires the mutation with
            // the still-current form value (form.getValues at fire-time).
            setShowThresholdGate(true);
            return;
        }
        mutate.mutate(values.refund_reason);
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('refund_dialog_title', { id: sale.id })}</DialogTitle>
                    <DialogDescription>{t('refund_dialog_body')}</DialogDescription>
                </DialogHeader>

                {!showThresholdGate ? (
                    <Form {...form}>
                        <form onSubmit={onSubmit} className='space-y-4'>
                            <FormField
                                control={form.control}
                                name='refund_reason'
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('refund_reason_label')}</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder={t('refund_reason_placeholder')}
                                                rows={4}
                                                maxLength={500}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {aboveThreshold ? (
                                <p className='text-amber-600 text-xs'>
                                    {t('refund_threshold_warning', {
                                        amount: sale.total_amount ?? sale.amount,
                                        id: sale.id,
                                    })}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => onOpenChange(false)}
                                >
                                    {t('refund_cancel')}
                                </Button>
                                <Button type='submit' disabled={mutate.isPending}>
                                    {t('refund_confirm')}
                                </Button>
                            </DialogFooter>

                            {/* Hidden input keeps the typed-id contract under the same form lifecycle.
                                Not used in zod schema — the gate's own input drives the second pane. */}
                            <input type='hidden' name='typed_id' />
                        </form>
                    </Form>
                ) : (
                    <TypeTheCountConfirmation
                        count={sale.id}
                        helperText={t('refund_type_id_placeholder')}
                        confirmLabel={t('refund_confirm')}
                        cancelLabel={t('refund_cancel')}
                        onConfirm={() => mutate.mutate(form.getValues().refund_reason)}
                        onCancel={() => setShowThresholdGate(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
