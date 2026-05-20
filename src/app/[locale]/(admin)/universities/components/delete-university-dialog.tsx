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
import { deleteUniversity } from '@/lib/universities/api';
import type { UniversityListRow } from '@/lib/universities/types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    university: UniversityListRow | null;
}

export function DeleteUniversityDialog({ open, onOpenChange, university }: Props) {
    const t = useTranslations('universities');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            if (!university) throw new Error('no_university');
            return deleteUniversity(university.id);
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['admin.universities.list'] });
            toast.success(t('deleted_toast'));
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message || t('error_generic')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_title')}</DialogTitle>
                    <DialogDescription>{t('delete_description', { name: university?.title_kk ?? '' })}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button
                        variant='destructive'
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate()}
                    >
                        {mutation.isPending ? t('deleting') : t('action_delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
