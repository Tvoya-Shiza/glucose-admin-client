'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteRole, type RoleSummary } from '@/lib/access/api';
import { toast } from 'sonner';

interface Props {
    role: RoleSummary;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteRoleDialog({ role, open, onOpenChange }: Props) {
    const t = useTranslations('admin.access');
    const del = useDeleteRole();

    async function onConfirm() {
        try {
            await del.mutateAsync(role.id);
            toast.success(t('delete_success'));
            onOpenChange(false);
        } catch (err) {
            const msg = (err as Error).message;
            if (msg === 'role_has_users') toast.error(t('cannot_delete_has_users'));
            else if (msg === 'cannot_delete_system_role') toast.error(t('cannot_delete_system'));
            else toast.error(msg);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_role_title')}</DialogTitle>
                    <DialogDescription>{t('delete_role_body', { name: role.name })}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={onConfirm} disabled={del.isPending}>
                        {del.isPending ? t('deleting') : t('confirm_delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
