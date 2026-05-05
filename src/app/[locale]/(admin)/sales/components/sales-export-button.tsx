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
import { exportSales } from '@/lib/sales/api';
import type { SaleExportInput } from '@/lib/sales/types';

export interface SalesExportButtonProps {
    /** Current filter snapshot from the list page (nuqs URL state). */
    filters: Omit<SaleExportInput, 'format'>;
}

/**
 * PAY-04 — sales export dropdown.
 *
 * Mirrors PaymentsExportButton (Phase 9 Plan 02): dropdown offers CSV / XLSX;
 * on selection POSTs the current filter snapshot to /api/proxy/v1/admin/sales/export
 * (BFF -> admin-api), receives a Blob, triggers a browser download via
 * URL.createObjectURL + a hidden <a> click. URL is revoked immediately after click.
 *
 * Filename mirrors admin-api's Content-Disposition (`sales-<unix>.<ext>`) so the
 * visible download name matches the audit trail.
 *
 * Error handling: 429 (throttled) is surfaced as the localized
 * `admin.sales.export_throttle` toast (falls back to `export_failed` if missing
 * — Plan 03 i18n superset doesn't include export_throttle); other errors fall
 * through with a generic export_failed toast.
 */
export function SalesExportButton({ filters }: SalesExportButtonProps) {
    const t = useTranslations('admin.sales');
    const [pending, setPending] = useState(false);

    const onPick = async (format: 'csv' | 'xlsx') => {
        if (pending) return;
        setPending(true);
        try {
            const blob = await exportSales({ ...filters, format });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = Math.floor(Date.now() / 1000);
            a.download = `sales-${ts}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            const message = (e as Error).message;
            // The Plan 01 admin.sales i18n superset locks only `export_csv` /
            // `export_xlsx`. Fall back to the raw error message — operators
            // benefit from the upstream status code on 429 / 500.
            toast.error(message);
        } finally {
            setPending(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' disabled={pending}>
                    {pending ? '…' : t('export_csv')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => onPick('csv')}>{t('export_csv')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPick('xlsx')}>{t('export_xlsx')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
