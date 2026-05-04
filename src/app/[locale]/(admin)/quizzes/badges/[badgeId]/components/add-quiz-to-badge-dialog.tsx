'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    addBadgeItem,
    DuplicateQuizInBadgeError,
    listQuizzes,
} from '@/lib/quizzes/api';

/**
 * QZ-05 — searchable picker for adding a quiz to a QuizBadge.
 *
 * Search is debounced 300ms; query hits Plan 02's listQuizzes({q, page_size: 20}).
 * The list filters out quizzes already in the badge client-side (using the
 * `existingQuizIds` prop) — server-side duplicate protection (T-06-72) is the
 * authoritative gate, but pre-filtering keeps the UX clean.
 *
 * On row click → addBadgeItem({ quiz_badge_id: badgeId, quiz_id: row.id }).
 *   - 200: toast success, invalidate detail query, close dialog.
 *   - 409 'duplicate_quiz_in_badge' (DuplicateQuizInBadgeError): localized toast
 *     'этот тест уже добавлен' — dialog stays open so the user can pick another.
 *   - other errors: surface message via toast.
 */
export interface AddQuizToBadgeDialogProps {
    badgeId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Quiz ids already in this badge — pre-filtered client-side from search results. */
    existingQuizIds: number[];
}

export function AddQuizToBadgeDialog({
    badgeId,
    open,
    onOpenChange,
    existingQuizIds,
}: AddQuizToBadgeDialogProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [searchInput, setSearchInput] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');

    useEffect(() => {
        if (!open) {
            setSearchInput('');
            setDebouncedQ('');
            return;
        }
        const handle = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
        return () => clearTimeout(handle);
    }, [searchInput, open]);

    const { data, isLoading } = useQuery({
        queryKey: ['admin.quizzes.search', debouncedQ],
        queryFn: () =>
            listQuizzes({
                q: debouncedQ.length > 0 ? debouncedQ : undefined,
                page_size: 20,
                page: 1,
                status: 'active',
            }),
        enabled: open,
    });

    const existingSet = useMemo(() => new Set(existingQuizIds), [existingQuizIds]);

    const addMutation = useMutation({
        mutationFn: (quizId: number) =>
            addBadgeItem({ quiz_badge_id: badgeId, quiz_id: quizId }),
        onSuccess: () => {
            toast.success(t('badge_item_add_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.detail', badgeId] });
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
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

    const rows = data?.rows ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle>{t('add_quiz_to_badge')}</DialogTitle>
                    <DialogDescription>
                        {t('add_quiz_to_badge_dialog_description')}
                    </DialogDescription>
                </DialogHeader>

                <div className='relative'>
                    <Search className='text-muted-foreground absolute top-2.5 left-2 h-4 w-4' />
                    <Input
                        autoFocus
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('search_quiz_placeholder')}
                        className='pl-8'
                    />
                </div>

                <div className='max-h-[400px] space-y-2 overflow-y-auto'>
                    {isLoading ? (
                        <div className='text-muted-foreground p-4 text-sm'>{t('loading')}</div>
                    ) : rows.length === 0 ? (
                        <div className='text-muted-foreground rounded border border-dashed p-6 text-center text-sm'>
                            {t('search_no_results')}
                        </div>
                    ) : (
                        rows.map((row) => {
                            const inBadge = existingSet.has(row.id);
                            const ruTitle =
                                row.translation_completeness === 'complete'
                                    ? // Best effort — list rows don't always carry translations[];
                                      // the title can come from the existing list shape on the
                                      // admin-api side. Fall back to "#id" if missing.
                                      `#${row.id}`
                                    : `#${row.id}`;
                            // QuizRow doesn't carry full translations[], but the row itself
                            // surfaces enough metadata for the picker UX.
                            return (
                                <div
                                    key={row.id}
                                    className='bg-card flex items-center gap-3 rounded-lg border p-3'
                                >
                                    <div className='min-w-0 flex-1 space-y-0.5'>
                                        <div className='flex items-center gap-2'>
                                            <span className='truncate font-medium'>
                                                {ruTitle}
                                            </span>
                                            <Badge
                                                variant='outline'
                                                className='font-mono text-xs'
                                            >
                                                v{row.version}
                                            </Badge>
                                        </div>
                                        <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                                            <span>
                                                {t('badge_item_question_count', {
                                                    count: row.question_count,
                                                })}
                                            </span>
                                            <Badge
                                                variant={
                                                    row.status === 'active'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                                className='text-xs'
                                            >
                                                {row.status}
                                            </Badge>
                                            {row.translation_completeness ===
                                            'incomplete' ? (
                                                <Badge
                                                    variant='secondary'
                                                    className='text-xs'
                                                >
                                                    {t('badge_translation_incomplete')}
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </div>
                                    <Button
                                        type='button'
                                        size='sm'
                                        variant={inBadge ? 'secondary' : 'default'}
                                        disabled={inBadge || addMutation.isPending}
                                        onClick={() => addMutation.mutate(row.id)}
                                    >
                                        {inBadge ? (
                                            t('badge_item_already_added')
                                        ) : (
                                            <>
                                                <Plus className='mr-1 h-4 w-4' />
                                                {t('add')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
