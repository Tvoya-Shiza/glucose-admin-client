'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface TypeTheCountConfirmationProps {
    count: number;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    helperText?: string;
}

/**
 * USR-05: when affected count > 50, the user must type the integer count to enable
 * the Confirm button. Reused across users (Plan 05), import (Plan 06), and Phase 7
 * stories/banners/blogs bulk-status changes.
 *
 * Client-only safety rail — admin-api MUST recompute the affected count server-side
 * (T-03-03 in plan threat model).
 */
export function TypeTheCountConfirmation({
    count,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    helperText,
}: TypeTheCountConfirmationProps) {
    const t = useTranslations('admin.users');
    const [value, setValue] = useState('');
    const matches = value.trim() === String(count);
    return (
        <div className='space-y-3'>
            <Label htmlFor='ttc-input' className='text-sm'>
                {helperText ?? t('type_count_to_confirm', { count })}
            </Label>
            <Input
                id='ttc-input'
                inputMode='numeric'
                autoComplete='off'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={String(count)}
            />
            <div className='flex justify-end gap-2'>
                <Button variant='outline' onClick={onCancel}>
                    {cancelLabel ?? t('cancel_action')}
                </Button>
                <Button onClick={onConfirm} disabled={!matches}>
                    {confirmLabel ?? t('confirm')}
                </Button>
            </div>
        </div>
    );
}
