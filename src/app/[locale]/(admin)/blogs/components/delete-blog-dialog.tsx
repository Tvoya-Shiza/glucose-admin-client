'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TypeTheCountConfirmation } from '@/components/users/type-the-count-confirmation';
import { deleteBlog } from '@/lib/blogs/api';
import type { BlogRow } from '@/lib/blogs/types';

export interface DeleteBlogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no row is selected — dialog stays closed via `open`. */
    blog: BlogRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * BLG-01 — admin hard-delete dialog.
 *
 * Blog has no `deleted_at` column on the schema, so DELETE is irreversible. We
 * gate the Delete action behind <TypeTheCountConfirmation count={blog.id}> — the
 * high-trust mutation pattern from Phase 3 Plan 04.
 *
 * On success: invalidate ['admin.blogs.list'], close, toast.
 */
export function DeleteBlogDialog({ open, onOpenChange, blog, onDeleted }: DeleteBlogDialogProps) {
    const t = useTranslations('admin.blogs');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteBlog(blog!.id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.blogs.list'], exact: false });
            const id = blog!.id;
            onOpenChange(false);
            onDeleted?.(id);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('save_failed');
            toast.error(msg);
        },
    });

    useEffect(() => {
        if (!open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const onConfirm = () => mutation.mutate();
    const onCancel = () => onOpenChange(false);
    const isPending = mutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('delete_confirm')}</DialogTitle>
                    <DialogDescription>{t('delete_warning')}</DialogDescription>
                </DialogHeader>

                {blog ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-medium'>{blog.title_ru ?? blog.slug}</p>
                        <p className='text-xs text-muted-foreground'>#{blog.id}</p>
                    </div>
                ) : null}

                {blog ? (
                    <TypeTheCountConfirmation
                        count={blog.id}
                        helperText={t('type_id_to_confirm', { id: blog.id })}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                        confirmLabel={isPending ? t('saving') : t('delete')}
                        cancelLabel={t('cancel')}
                    />
                ) : (
                    <DialogFooter>
                        <Button variant='outline' onClick={onCancel}>
                            {t('cancel')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
