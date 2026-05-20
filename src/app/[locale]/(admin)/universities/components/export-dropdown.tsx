'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadTemplate, exportData, triggerBrowserDownload } from '@/lib/universities/api';
import type { ImportKind } from '@/lib/universities/types';

interface Props {
    kind: ImportKind;
}

const FILENAMES: Record<ImportKind, { template: string; data: string }> = {
    universities: { template: 'Universities-template.xlsx', data: 'Universities-export.xlsx' },
    specialties: { template: 'Specialties-template.xlsx', data: 'Specialties-export.xlsx' },
    admission_stats: { template: 'AdmissionStats-template.xlsx', data: 'AdmissionStats-export.xlsx' },
};

export function ExportDropdown({ kind }: Props) {
    const t = useTranslations('universities');
    const [busy, setBusy] = useState<'template' | 'data' | null>(null);

    const handleTemplate = async () => {
        setBusy('template');
        try {
            const blob = await downloadTemplate(kind);
            triggerBrowserDownload(blob, FILENAMES[kind].template);
        } catch (e) {
            toast.error((e as Error).message || t('error_generic'));
        } finally {
            setBusy(null);
        }
    };

    const handleExport = async () => {
        setBusy('data');
        try {
            const blob = await exportData(kind);
            triggerBrowserDownload(blob, FILENAMES[kind].data);
        } catch (e) {
            toast.error((e as Error).message || t('error_generic'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>
                    <Download className='mr-2 size-4' />
                    {t('export_button')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuLabel>{t(`kind_${kind}`)}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={busy !== null} onSelect={() => void handleTemplate()}>
                    {busy === 'template' ? t('downloading') : t('download_template')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={busy !== null} onSelect={() => void handleExport()}>
                    {busy === 'data' ? t('downloading') : t('export_data')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
