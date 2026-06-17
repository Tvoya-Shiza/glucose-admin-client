'use client';

import { useEffect } from 'react';
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
import { deleteUser } from '@/lib/users/api';
import type { UserRow } from '@/lib/users/types';

export interface DeleteUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no user is selected — dialog stays closed via `open`. */
    user: UserRow | null;
}

/**
 * USR — delete-user dialog.
 *
 * Soft-delete (admin-api stamps `deleted_at`): the user is hidden from lists and can no
 * longer log in, but their data/history stay in the DB. A physical delete is intentionally
 * not offered — the User schema cascades on nearly every relation (incl. referrals).
 */
export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteUser(user!.id),
        onSuccess: () => {
            toast.success(t('deleted'));
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('delete_error'));
        },
    });

    // Reset mutation state when dialog closes so re-opens start fresh.
    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const isPending = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_user_title')}</DialogTitle>
                    <DialogDescription>{t('delete_user_description')}</DialogDescription>
                </DialogHeader>

                {user ? (
                    <div className='space-y-2 text-sm'>
                        <p className='font-medium'>{user.full_name ?? user.email ?? `#${user.id}`}</p>
                        <p className='text-muted-foreground text-xs'>{t('delete_user_soft_note')}</p>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={() => mutation.mutate()}
                        disabled={isPending || !user}
                    >
                        {isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
