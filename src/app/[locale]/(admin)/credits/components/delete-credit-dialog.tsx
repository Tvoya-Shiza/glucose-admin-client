'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditApiError, deleteCredit } from '@/lib/credits/api';

export interface DeleteCreditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    credit: { id: string; title: string } | null;
}

/**
 * Soft-delete confirm. 409 `credits.active_sessions` (pending/in_progress
 * sessions exist) surfaces a dedicated toast.
 */
export function DeleteCreditDialog({ open, onOpenChange, credit }: DeleteCreditDialogProps) {
    const t = useTranslations('admin.credits');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname() ?? '';
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (id: string) => deleteCredit(id),
        onSuccess: (_res, id) => {
            toast.success(t('deleted_success'));
            qc.invalidateQueries({ queryKey: ['admin.credits.list'], exact: false });
            onOpenChange(false);
            // If we're on the deleted credit's detail page, go back to the list.
            if (pathname.includes(`/credits/${id}`)) router.push(`/${locale}/credits`);
        },
        onError: (err: unknown) => {
            if (err instanceof CreditApiError && err.code === 'credits.active_sessions') {
                toast.error(t('delete_active_sessions_error'));
                return;
            }
            const msg = err instanceof Error && err.message ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                    <DialogDescription>{credit ? t('delete_dialog_description', { title: credit.title }) : null}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        disabled={credit == null || mutation.isPending}
                        onClick={() => credit && mutation.mutate(credit.id)}
                    >
                        {mutation.isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
