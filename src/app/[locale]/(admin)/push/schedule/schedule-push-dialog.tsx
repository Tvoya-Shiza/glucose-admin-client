'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Phase 8 Plan 04 — schedule date-time picker dialog (D-07).
 *
 * Asia/Almaty → UTC seconds conversion:
 *   - <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" in the user's LOCAL
 *     timezone. v1 has no per-user timezone preference; we ASSUME the staff
 *     user is in Asia/Almaty (the platform's primary operating zone). To make
 *     the conversion explicit (independent of the browser's TZ), we append
 *     ":00+05:00" — Asia/Almaty's fixed UTC offset (no DST). Date.parse()
 *     yields the absolute Unix milliseconds, which we floor-divide by 1000.
 *   - This means a user in any TZ that picks "30 апр 14:30" gets the same
 *     server-side scheduled_at: 14:30 Asia/Almaty regardless of their device.
 *
 * Validation:
 *   - submit blocks empty input
 *   - submit blocks scheduled_at <= now+30s (server enforces the same buffer
 *     in PushScheduleService.schedule(); UI mirrors it for fast feedback)
 *
 * v2 polish (deferred):
 *   - shadcn Calendar + per-user TZ pref
 *   - localized date-formatting next to the input ("это 14:30 Asia/Almaty")
 */
interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: (scheduledAtUnix: number) => void;
    pending?: boolean;
}

const MIN_BUFFER_SECONDS = 30;

export function SchedulePushDialog({ open, onClose, onConfirm, pending }: Props) {
    const t = useTranslations('admin.push');
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Reset on open/close so a previously-typed value doesn't leak across opens.
    useEffect(() => {
        if (!open) {
            setValue('');
            setError(null);
        }
    }, [open]);

    function submit() {
        setError(null);
        if (!value) return;
        // Treat the picker output as Asia/Almaty by appending the fixed +05:00 offset.
        const isoWithOffset = `${value}:00+05:00`;
        const ms = Date.parse(isoWithOffset);
        if (Number.isNaN(ms)) {
            setError(t('schedule_at_in_past'));
            return;
        }
        const unix = Math.floor(ms / 1000);
        const nowUnix = Math.floor(Date.now() / 1000);
        if (unix <= nowUnix + MIN_BUFFER_SECONDS) {
            setError(t('schedule_at_in_past'));
            return;
        }
        onConfirm(unix);
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('schedule_button')}</DialogTitle>
                </DialogHeader>
                <div className='flex flex-col gap-2'>
                    <Label htmlFor='schedule_at'>{t('schedule_at_label')}</Label>
                    <Input
                        id='schedule_at'
                        type='datetime-local'
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                    />
                    <p className='text-muted-foreground text-xs'>{t('schedule_at_help')}</p>
                    {error ? <p className='text-destructive text-xs'>{error}</p> : null}
                </div>
                <DialogFooter>
                    <Button variant='ghost' onClick={onClose} disabled={pending}>
                        {t('schedule_cancel')}
                    </Button>
                    <Button onClick={submit} disabled={pending || !value}>
                        {t('schedule_button')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
