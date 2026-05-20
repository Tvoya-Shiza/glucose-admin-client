'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteAssignment } from '@/lib/assignments/api';
import type { AssignmentRow } from '@/lib/assignments/types';

interface DeleteAssignmentDialogProps {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    assignment: AssignmentRow | null;
}

export function DeleteAssignmentDialog({ open, onOpenChange, assignment }: DeleteAssignmentDialogProps) {
    const t = useTranslations('admin.assignments');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            if (!assignment) return;
            await deleteAssignment(assignment.id);
        },
        onSuccess: () => {
            toast.success(t('delete_success'));
            qc.invalidateQueries({ queryKey: ['admin.assignments.list'] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.analytics'] });
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(t('delete_failed'), { description: e.message }),
    });

    const title = assignment?.title_kz ?? assignment?.title_ru ?? `#${assignment?.id ?? ''}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                </DialogHeader>
                <p className='text-sm text-muted-foreground'>{t('delete_dialog_description', { title })}</p>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                        {mutation.isPending ? t('saving_dot') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
