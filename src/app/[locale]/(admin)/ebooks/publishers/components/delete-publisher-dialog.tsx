'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { deletePublisher } from '@/lib/ebooks/api';
import type { PublisherRow } from '@/lib/ebooks/types';

export interface DeletePublisherDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publisher: PublisherRow | null;
}

/**
 * Delete a publisher. The Book.publisher_id FK is ON DELETE SET NULL, so this is
 * a HARD delete of the publisher row that is still safe for its books: they only
 * lose the link. The dialog shows how many books are attached up front, and the
 * server echoes `unlinked_books` back so the toast can report the real number.
 */
export function DeletePublisherDialog({ open, onOpenChange, publisher }: DeletePublisherDialogProps) {
    const t = useTranslations('admin.ebooks');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deletePublisher(publisher!.id),
        onSuccess: (result) => {
            toast.success(t('publisher_delete_success', { unlinked: result.unlinked_books }));
            qc.invalidateQueries({ queryKey: ['admin.publishers.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.ebooks.list'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : t('generic_error'));
        },
    });

    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('publisher_delete_title')}</DialogTitle>
                    <DialogDescription>{t('publisher_delete_description')}</DialogDescription>
                </DialogHeader>

                {publisher ? (
                    <div className='space-y-2 text-sm'>
                        <p className='font-medium'>{publisher.name}</p>
                        <p className='text-muted-foreground text-xs'>{t('publisher_delete_note', { count: publisher.book_count })}</p>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                        {t('cancel')}
                    </Button>
                    <Button variant='destructive' onClick={() => mutation.mutate()} disabled={mutation.isPending || !publisher}>
                        {mutation.isPending ? t('loading') : t('delete')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
