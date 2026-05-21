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
import { exportUserDetail } from '@/lib/users/api';

/**
 * Per-user export button for the detail page header. CSV or multi-sheet XLSX
 * (Profile / Courses / Tests / Payments). admin-api throttles 10/15min/IP and
 * audits each call as `users.exportDetail`.
 */
export function ExportUserButton({ userId }: { userId: number }) {
    const t = useTranslations('admin.users');
    const [pending, setPending] = useState(false);

    const onPick = async (format: 'csv' | 'xlsx') => {
        if (pending) return;
        setPending(true);
        try {
            const blob = await exportUserDetail(userId, format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ts = Math.floor(Date.now() / 1000);
            a.download = `user-${userId}-${ts}.${format}`;
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
                    {pending ? t('export_pending') : t('export_user_title')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => onPick('csv')}>{t('export_format_csv')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onPick('xlsx')}>{t('export_format_xlsx')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
