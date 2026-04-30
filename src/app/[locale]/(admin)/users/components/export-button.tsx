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
import { exportUsers, type ExportInput } from '@/lib/users/api';

export interface ExportButtonProps {
    /** Current filter snapshot from the list page (nuqs URL state). */
    filters: Omit<ExportInput, 'format'>;
}

/**
 * USR-07 — Plan 07 ExportButton.
 *
 * Mounted next to the list header (users-list-client.tsx). Dropdown offers CSV / XLSX;
 * on selection POSTs the current filter snapshot to /api/proxy/v1/admin/users/export
 * (BFF -> admin-api), receives a Blob, triggers a browser download via
 * URL.createObjectURL + a hidden <a> click. URL is revoked immediately after click.
 *
 * Filename mirrors admin-api's Content-Disposition (users-<unix>.<ext>) so the visible
 * download name matches what the operator would see if they opened the response
 * directly (audit-friendly).
 */
export function ExportButton({ filters }: ExportButtonProps) {
    const t = useTranslations('admin.users');
    const [pending, setPending] = useState(false);

    const onPick = async (format: 'csv' | 'xlsx') => {
        if (pending) return;
        setPending(true);
        try {
            const blob = await exportUsers({ ...filters, format });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = Math.floor(Date.now() / 1000);
            a.download = `users-${ts}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t('export_download'));
        } catch (e) {
            const message = (e as Error).message ?? t('error_generic');
            toast.error(message);
        } finally {
            setPending(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' disabled={pending}>
                    {pending ? t('export_pending') : t('export_title')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => onPick('csv')}>
                    {t('export_format_csv')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPick('xlsx')}>
                    {t('export_format_xlsx')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
