'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportGridPdf, exportGridXlsx } from '@/lib/rating-journal/export';
import type { JournalGrid } from '@/lib/rating-journal/types';

export interface ExportMenuProps {
    grid: JournalGrid;
}

/**
 * Client-side export dropdown (xlsx + pdf). Both formats render the current grid;
 * the heavy libraries are dynamically imported inside lib/rating-journal/export.
 * Gated by <Can permission="rating_journal.export"> at the call site.
 */
export function ExportMenu({ grid }: ExportMenuProps) {
    const t = useTranslations('admin.ratingJournal');
    const [pending, setPending] = useState(false);

    const labels = {
        studentHeader: t('col_student'),
        totalHeader: t('col_total'),
        title: grid.journal.title,
    };

    const run = async (format: 'xlsx' | 'pdf') => {
        if (pending) return;
        setPending(true);
        try {
            if (format === 'xlsx') {
                await exportGridXlsx(grid, labels);
            } else {
                await exportGridPdf(grid, labels);
            }
            toast.success(t('export_success'));
        } catch (e) {
            toast.error((e as Error).message ?? t('generic_error'));
        } finally {
            setPending(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' disabled={pending}>
                    <Download className='mr-2 h-4 w-4' />
                    {pending ? t('export_pending') : t('export_title')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={() => run('xlsx')}>{t('export_xlsx')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('pdf')}>{t('export_pdf')}</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
