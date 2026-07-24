'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deleteBook } from '@/lib/ebooks/api';
import type { BookRow } from '@/lib/ebooks/types';

export interface DeleteBookDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    book: BookRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * Admin delete-book dialog (soft delete). DELETE /ebooks/:id stamps deleted_at
 * and forces status='inactive'; pages, translations and reader progress are all
 * preserved, and publishing the book 'active' again clears deleted_at. The book
 * is also de-indexed from the Postgres search projection server-side.
 *
 * RBAC: the dialog only mounts when the parent grants `ebooks.delete`; the
 * server RolesGuard + PermissionGuard re-check.
 */
export function DeleteBookDialog({ open, onOpenChange, book, onDeleted }: DeleteBookDialogProps) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteBook(book!.id),
        onSuccess: () => {
            toast.success(t('delete_success'));
            const deletedId = book!.id;
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
            qc.removeQueries({ queryKey: ['admin.ebooks.detail', deletedId] });
            onOpenChange(false);
            onDeleted?.(deletedId);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const isPending = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_dialog_title')}</DialogTitle>
                    <DialogDescription>{t('delete_dialog_description')}</DialogDescription>
                </DialogHeader>

                {book ? (
                    <div className='space-y-2 text-sm'>
                        <p className='font-medium'>{book.title_kz ?? `#${book.id}`}</p>
                        <p className='text-muted-foreground text-xs'>{t('delete_soft_note')}</p>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={() => mutation.mutate()} disabled={isPending || !book}>
                        {isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
