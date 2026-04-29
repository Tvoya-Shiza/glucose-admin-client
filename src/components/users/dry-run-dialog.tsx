'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TypeTheCountConfirmation } from './type-the-count-confirmation';
import type { DryRunResult } from '@/hooks/use-dry-run-preview';

export interface DryRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    result: DryRunResult | null;
    onConfirm: () => void;
    /** Count above which the type-the-count gate engages. Default 50 per USR-05. */
    threshold?: number;
}

/**
 * USR-04 + USR-05: render dry-run preview rows + status counts in a dialog. If the
 * affected count is greater than `threshold` (default 50), gate the Confirm action
 * behind <TypeTheCountConfirmation>. Otherwise show a simple Confirm button.
 *
 * Generic — Plans 05/06 (users) and Phase 7 (Stories/Banners/Blogs bulk-status)
 * reuse this dialog by passing their own DryRunResult shape.
 */
export function DryRunDialog({ open, onOpenChange, result, onConfirm, threshold = 50 }: DryRunDialogProps) {
    const t = useTranslations('admin.users');
    const total = result?.affected ?? 0;
    const showTypeGate = total > threshold;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('bulk_dry_run')}</DialogTitle>
                </DialogHeader>

                {!result ? (
                    <p className='text-sm text-muted-foreground'>{t('loading')}</p>
                ) : (
                    <div className='space-y-4'>
                        <div className='flex flex-wrap gap-2 text-xs'>
                            <Badge variant='default'>insert: {result.insert}</Badge>
                            <Badge variant='secondary'>update: {result.update}</Badge>
                            <Badge variant='outline'>skip: {result.skip}</Badge>
                            <Badge variant='destructive'>error: {result.error}</Badge>
                        </div>

                        <div className='max-h-72 overflow-auto rounded-md border'>
                            <table className='w-full text-sm'>
                                <thead className='border-b bg-muted/40'>
                                    <tr>
                                        <th className='p-2 text-left'>id</th>
                                        <th className='p-2 text-left'>status</th>
                                        <th className='p-2 text-left'>reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.slice(0, 200).map((r, i) => (
                                        <tr key={i} className='border-b last:border-0'>
                                            <td className='p-2 font-mono text-xs'>{r.row_id}</td>
                                            <td className='p-2'>{r.status}</td>
                                            <td className='p-2 text-muted-foreground'>{r.reason ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {showTypeGate ? (
                            <TypeTheCountConfirmation
                                count={total}
                                onConfirm={onConfirm}
                                onCancel={() => onOpenChange(false)}
                            />
                        ) : (
                            <DialogFooter>
                                <Button variant='outline' onClick={() => onOpenChange(false)}>
                                    {t('cancel_action')}
                                </Button>
                                <Button onClick={onConfirm}>{t('bulk_confirm')}</Button>
                            </DialogFooter>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
