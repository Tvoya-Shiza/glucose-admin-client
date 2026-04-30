'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { changeUserRole, ROLE_OPTIONS } from '@/lib/users/api';

export interface RoleChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: { id: number; full_name: string | null; role_id: number; role_name: string };
    /** Fires after a successful role change; caller may rely on this in addition to query invalidation. */
    onChanged?: () => void;
}

type StaffOrStudentRoleName = 'admin' | 'curator' | 'teacher' | 'student';

/**
 * USR-03 (role-change half) — Plan 04. Per CONTEXT D-11, role change is a dedicated
 * dialog (NOT inline edit on the Profile tab) because the audit + cascade consequences
 * are larger than other profile fields.
 *
 * Two-pane flow:
 *   1. Default pane: select target role + role_id + optional reason; "Save" submits.
 *   2. When target is `'admin'` AND current is NOT already `'admin'`, "Save" instead
 *      reveals TypeTheCountConfirmation — the admin must type `String(user.id)` to
 *      arm the Confirm button. T-03-32: server-side gate is independent, this is UX.
 *
 * On success: invalidate `['admin.users.detail', String(user.id)]` and the list query
 * key so the detail page + any open list page refetch with the new role. Closes the
 * dialog and fires `onChanged?.()`.
 */
export function RoleChangeDialog({ open, onOpenChange, user, onChanged }: RoleChangeDialogProps) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();

    const initialRoleName = (user.role_name as StaffOrStudentRoleName) ?? 'student';
    const [roleName, setRoleName] = useState<StaffOrStudentRoleName>(initialRoleName);
    const [roleId, setRoleId] = useState<number>(user.role_id);
    const [reason, setReason] = useState('');
    const [showAdminConfirm, setShowAdminConfirm] = useState(false);

    // Reset local state when the dialog closes/reopens for a different user (or after a successful change).
    useEffect(() => {
        if (open) {
            setRoleName(initialRoleName);
            setRoleId(user.role_id);
            setReason('');
            setShowAdminConfirm(false);
        }
    }, [open, user.id, user.role_id, initialRoleName]);

    const mutate = useMutation({
        mutationFn: (confirmation?: string) =>
            changeUserRole(user.id, {
                role_id: roleId,
                role_name: roleName,
                reason: reason.trim() || undefined,
                confirmation,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.users.detail', String(user.id)] });
            qc.invalidateQueries({ queryKey: ['admin.users.list'], exact: false });
            toast.success(t('saved'));
            onChanged?.();
            onOpenChange(false);
        },
        onError: (e: Error) => toast.error(e.message ?? t('save_failed')),
    });

    const onSelectRole = (name: string) => {
        const opt = ROLE_OPTIONS.find((r) => r.name === name);
        if (opt) {
            setRoleName(opt.name);
            setRoleId(opt.id);
        }
    };

    const onSubmit = () => {
        // Admin-escalation gate: only when promoting to admin from a non-admin role.
        if (roleName === 'admin' && user.role_name !== 'admin') {
            setShowAdminConfirm(true);
            return;
        }
        mutate.mutate(undefined);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('change_role')}</DialogTitle>
                    <DialogDescription>{t('role_change_warning')}</DialogDescription>
                </DialogHeader>

                {!showAdminConfirm ? (
                    <div className='space-y-3'>
                        <div className='text-sm'>
                            {user.full_name ?? '—'} · {t('col_role')}:{' '}
                            <strong>{user.role_name}</strong>
                        </div>
                        <div className='space-y-2'>
                            <Label>{t('filter_role')}</Label>
                            <Select value={roleName} onValueChange={onSelectRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='admin'>{t('role_admin')}</SelectItem>
                                    <SelectItem value='curator'>{t('role_curator')}</SelectItem>
                                    <SelectItem value='teacher'>{t('role_teacher')}</SelectItem>
                                    <SelectItem value='student'>{t('role_student')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='role-id-input'>role_id</Label>
                            <Input
                                id='role-id-input'
                                type='number'
                                value={roleId}
                                onChange={(e) => setRoleId(Number(e.target.value) || 0)}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='role-reason-input'>reason</Label>
                            <Input
                                id='role-reason-input'
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                maxLength={500}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant='outline' onClick={() => onOpenChange(false)}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={onSubmit} disabled={mutate.isPending}>
                                {mutate.isPending ? t('saving') : t('save')}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <TypeTheCountConfirmation
                        count={user.id}
                        helperText={`Type ${user.id} to confirm promoting this user to admin`}
                        onConfirm={() => mutate.mutate(String(user.id))}
                        onCancel={() => setShowAdminConfirm(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
