'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { QuizBadgePicker } from '@/components/quizzes/quiz-badge-picker';
import { DuplicateQuizInBadgeError, addBadgeItem } from '@/lib/quizzes/api';
import type { QuizRow } from '@/lib/quizzes/types';

export interface AddToBadgeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: QuizRow | null;
}

/**
 * Pick a badge and POST /quiz-badges/:id/items to attach the current quiz row to
 * it. Mirrors the duplicate-quiz-in-badge 409 envelope from `addBadgeItem` —
 * surfaces a localized "already added" toast without closing the dialog so the
 * operator can pick another badge.
 */
export function AddToBadgeDialog({ open, onOpenChange, quiz }: AddToBadgeDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();
    const [badgeId, setBadgeId] = useState<number | null>(null);

    useEffect(() => {
        if (!open) setBadgeId(null);
    }, [open]);

    const mutation = useMutation({
        mutationFn: () => {
            if (!quiz || badgeId == null) throw new Error('invariant');
            return addBadgeItem({ quiz_badge_id: badgeId, quiz_id: quiz.id });
        },
        onSuccess: () => {
            toast.success(t('badge_item_add_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.detail', badgeId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.list'], exact: false });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            if (err instanceof DuplicateQuizInBadgeError) {
                toast.error(t('badge_item_duplicate_quiz'));
                return;
            }
            const msg = err instanceof Error ? err.message : t('generic_error');
            toast.error(msg);
        },
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>{t('add_quiz_to_badge')}</DialogTitle>
                    <DialogDescription>{t('add_quiz_to_badge_dialog_description')}</DialogDescription>
                </DialogHeader>
                <div className='space-y-3 py-2'>
                    {quiz ? (
                        <div className='text-muted-foreground text-sm'>
                            #{quiz.id} · {quiz.title_kz ?? '—'}
                        </div>
                    ) : null}
                    <div className='space-y-1.5'>
                        <Label className='text-xs'>{t('filter_badge')}</Label>
                        <QuizBadgePicker
                            value={badgeId}
                            onChange={(id) => setBadgeId(id)}
                            placeholder={t('badge_category_placeholder')}
                            activeOnly
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        type='button'
                        onClick={() => mutation.mutate()}
                        disabled={badgeId == null || mutation.isPending || quiz == null}
                    >
                        {mutation.isPending ? t('loading') : t('add')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
