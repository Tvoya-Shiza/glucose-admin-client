'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportPayments } from '@/lib/payments/api';
import type { PaymentExportInput } from '@/lib/payments/types';

export interface PaymentsExportButtonProps {
    /** Current filter snapshot from the list page (nuqs URL state). */
    filters: Omit<PaymentExportInput, 'format'>;
}

/**
 * PAY-04 — payments export dropdown.
 *
 * Mirrors Phase 3 ExportButton: dropdown offers CSV / XLSX; on selection POSTs
 * the current filter snapshot to /api/proxy/v1/admin/payments/export (BFF -> admin-api),
 * receives a Blob, triggers a browser download via URL.createObjectURL + a hidden
 * <a> click. URL is revoked immediately after click.
 *
 * Filename mirrors admin-api's Content-Disposition (`payments-<unix>.<ext>`) so the
 * visible download name matches the audit trail.
 *
 * Error handling: 429 (throttled) is surfaced as the localized
 * `admin.payments.export_throttle` toast; other errors fall through with the raw
 * upstream message for ops debugging.
 */
export function PaymentsExportButton({ filters }: PaymentsExportButtonProps) {
    const t = useTranslations('admin.payments');
    const [pending, setPending] = useState(false);

    const onPick = async (format: 'csv' | 'xlsx') => {
        if (pending) return;
        setPending(true);
        try {
            const blob = await exportPayments({ ...filters, format });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = Math.floor(Date.now() / 1000);
            a.download = `payments-${ts}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            const message = (e as Error).message;
            if (message === 'export_throttle') {
                toast.error(t('export_throttle'));
            } else {
                toast.error(t('export_failed'));
            }
        } finally {
            setPending(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' disabled={pending}>
                    {pending ? '…' : t('export_csv').replace(/^.*\s/, '⇣ ')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => onPick('csv')}>
                    {t('export_csv')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPick('xlsx')}>
                    {t('export_xlsx')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
