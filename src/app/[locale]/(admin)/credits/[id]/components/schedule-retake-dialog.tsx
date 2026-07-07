'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scheduleCreditSessionRetake } from '@/lib/credits/api';
import { fromDatetimeLocal, toDatetimeLocal } from '@/lib/credits/format';
import type { CreditHistoryRow } from '@/lib/credits/types';

export interface ScheduleRetakeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creditId: string;
    /** Failed (finalized non-passed) history row the retake is scheduled for. */
    row: CreditHistoryRow | null;
}

/**
 * Schedules a retake datetime on a failed session
 * (POST /credit-sessions/:id/schedule-retake).
 */
export function ScheduleRetakeDialog({ open, onOpenChange, creditId, row }: ScheduleRetakeDialogProps) {
    const t = useTranslations('admin.credits');
    const qc = useQueryClient();
    const [value, setValue] = useState('');

    useEffect(() => {
        if (open) setValue(toDatetimeLocal(row?.retake_at ?? null));
    }, [open, row]);

    const mutation = useMutation({
        mutationFn: (args: { sessionId: string; retakeAt: number }) => scheduleCreditSessionRetake(args.sessionId, args.retakeAt),
        onSuccess: () => {
            toast.success(t('retake_success'));
            qc.invalidateQueries({ queryKey: ['admin.credits.history', creditId], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.credits.detail', creditId] });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    const retakeAt = fromDatetimeLocal(value);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('retake_dialog_title')}</DialogTitle>
                    <DialogDescription>{row ? t('retake_dialog_description', { student: row.student.full_name ?? '—' }) : null}</DialogDescription>
                </DialogHeader>
                <div className='space-y-2'>
                    <Label htmlFor='retake-at'>{t('retake_date_label')}</Label>
                    <Input id='retake-at' type='datetime-local' value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        disabled={row == null || retakeAt === undefined || mutation.isPending}
                        onClick={() => {
                            if (row && retakeAt !== undefined) {
                                mutation.mutate({ sessionId: row.session_id, retakeAt });
                            }
                        }}
                    >
                        {mutation.isPending ? t('loading') : t('schedule_retake')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
