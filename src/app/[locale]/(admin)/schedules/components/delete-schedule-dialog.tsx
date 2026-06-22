'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { deleteSchedule } from '@/lib/schedules/api';
import { htmlToPlainText } from '@/lib/schedules/format';
import type { Schedule } from '@/lib/schedules/types';

interface DeleteScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: Schedule | null;
}

export function DeleteScheduleDialog({ open, onOpenChange, schedule }: DeleteScheduleDialogProps) {
    const t = useTranslations('admin.schedules');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => {
            if (!schedule) throw new Error('schedule.not_found');
            return deleteSchedule(schedule.id);
        },
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.schedules.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.calendar'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.analytics'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('delete_failed');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_title')}</DialogTitle>
                    <DialogDescription>{t('delete_confirm')}</DialogDescription>
                </DialogHeader>
                {schedule ? (
                    <div className='rounded border bg-muted/30 p-3 text-sm'>
                        <div className='font-medium'>{schedule.group_name}</div>
                        <div className='line-clamp-2 text-xs text-muted-foreground'>
                            {schedule.description ? htmlToPlainText(schedule.description) : '—'}
                        </div>
                    </div>
                ) : null}
                <DialogFooter>
                    <Button variant='ghost' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? t('deleting') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
