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
import { deleteStory } from '@/lib/stories/api';
import type { StoryRow } from '@/lib/stories/types';

export interface DeleteStoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** null when no row is selected — dialog stays closed via `open`. */
    story: StoryRow | null;
    onDeleted?: (deletedId: number) => void;
}

/**
 * STY-01 — admin hard-delete dialog.
 *
 * Story has no `deleted_at` column on the schema, so DELETE is irreversible. We
 * gate the Delete action behind <TypeTheCountConfirmation count={story.id}>
 * (helperText surfaces the type-id-to-confirm copy from i18n) — the high-trust
 * mutation pattern from Phase 3 Plan 04 (D-11 reference-implementation contract).
 *
 * On success: invalidate ['admin.stories.list'], close, toast.
 */
export function DeleteStoryDialog({ open, onOpenChange, story, onDeleted }: DeleteStoryDialogProps) {
    const t = useTranslations('admin.stories');
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => deleteStory(story!.id),
        onSuccess: () => {
            toast.success(t('deleted_toast'));
            qc.invalidateQueries({ queryKey: ['admin.stories.list'], exact: false });
            const id = story!.id;
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

                {story ? (
                    <div className='space-y-3 text-sm'>
                        <p className='font-medium'>{story.title_ru ?? story.slug}</p>
                        <p className='text-xs text-muted-foreground'>#{story.id}</p>
                    </div>
                ) : null}

                {story ? (
                    <TypeTheCountConfirmation
                        count={story.id}
                        helperText={t('type_id_to_confirm', { id: story.id })}
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
