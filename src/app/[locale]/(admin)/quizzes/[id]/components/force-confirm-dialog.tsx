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

/**
 * ForceConfirmDialog — QZ-06 destructive-edit gate UI (Phase 6 Plan 05).
 *
 * Triggered when an admin/teacher attempts a DESTRUCTIVE edit on a quiz that has
 * one or more `QuizResult.status='waiting'` rows (students mid-attempt). The
 * admin-api responds with 409 + ForceConfirmRequiredError carrying:
 *
 *   { open_attempts_count: N, force_confirm_token: <signed JWT>, expires_at: <unix-sec> }
 *
 * UX flow (per CONTEXT D-12):
 *   1. Caller mutation throws ForceConfirmRequiredError.
 *   2. Caller opens this dialog with the count.
 *   3. User clicks Confirm → caller re-submits the EXACT same payload with
 *      force_confirm_token populated.
 *   4. Admin-api verifies signature + edit_intent_hash + Redis SET NX on jti
 *      (single-use), bumps Quizzes.version inside the SAME $tx as the destructive
 *      write (no race window — T-06-53), applies the edit.
 *
 * The dialog is purely PRESENTATIONAL — it does not own the retry. The caller
 * tracks the original payload + token and re-calls the mutation on confirm.
 *
 * IMPORTANT: the retry MUST use the EXACT same payload that triggered the 409.
 * Any drift produces a different edit_intent_hash and 401s with
 * 'force_confirm.payload_changed'.
 */
export interface ForceConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    openAttemptsCount: number;
    onConfirm: () => void;
    isPending?: boolean;
}

export function ForceConfirmDialog({
    open,
    onOpenChange,
    openAttemptsCount,
    onConfirm,
    isPending,
}: ForceConfirmDialogProps) {
    const t = useTranslations('admin.quizzes');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('force_confirm_title')}</DialogTitle>
                    <DialogDescription>
                        {t('force_confirm_open_attempts', { count: openAttemptsCount })}
                    </DialogDescription>
                </DialogHeader>
                <div className='text-muted-foreground text-sm'>
                    {t('force_confirm_warning')}
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        {t('force_confirm_cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='destructive'
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? t('saving_dot') : t('force_confirm_button')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
