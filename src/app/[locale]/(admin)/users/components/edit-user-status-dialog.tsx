'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { patchUserProfile } from '@/lib/users/api';
import { statusLabelKey } from '@/lib/users/format';
import type { UserRow, UserStatus } from '@/lib/users/types';

export interface EditUserStatusDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no user is selected — dialog stays closed via `open`. */
    user: UserRow | null;
}

const STATUS_OPTIONS: UserStatus[] = ['active', 'inactive', 'pending'];

/**
 * USR — change a user's account status (active / inactive / pending).
 *
 * Reuses the existing PATCH /:id/profile endpoint (which already accepts `status`
 * under the `users.edit` permission) — no new backend surface. `inactive` blocks login.
 */
export function EditUserStatusDialog({ open, onOpenChange, user }: EditUserStatusDialogProps) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();
    const [status, setStatus] = useState<UserStatus>(user?.status ?? 'active');

    // Re-seed the select from the row whenever the dialog opens for a (different) user.
    useEffect(() => {
        if (open) setStatus(user?.status ?? 'active');
    }, [open, user?.id, user?.status]);

    const mutation = useMutation({
        mutationFn: () => patchUserProfile(user!.id, { status }),
        onSuccess: () => {
            toast.success(t('status_changed'));
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.users.detail', user!.id] });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('status_change_error'));
        },
    });

    const isPending = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('change_status_title')}</DialogTitle>
                    <DialogDescription>{t('change_status_description')}</DialogDescription>
                </DialogHeader>

                {user ? (
                    <div className='space-y-3'>
                        <p className='text-sm font-medium'>{user.full_name ?? user.email ?? `#${user.id}`}</p>
                        <div className='space-y-1.5'>
                            <Label>{t('col_status')}</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as UserStatus)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {t(statusLabelKey(s))}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={isPending || !user || status === user?.status}
                    >
                        {isPending ? t('loading') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
