'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    DndContext,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { removeBadgeItem, reorderBadgeItems } from '@/lib/quizzes/api';
import type { QuizBadgeItemRow } from '@/lib/quizzes/types';
import { AddQuizToBadgeDialog } from './add-quiz-to-badge-dialog';

/**
 * QZ-05 — sortable list of member quizzes inside a QuizBadge.
 *
 * Pattern (mirrors Phase 5 chapter-tree-editor.tsx + Plan 05 questions-list.tsx):
 *   1. Snapshot pre-drag rows[] for rollback in `snapshotRef`.
 *   2. Apply move locally with arrayMove (instant visual feedback).
 *   3. Build full items[] payload (id + new order, 1-based).
 *   4. Call reorderBadgeItems mutation. PERSISTED (unlike question/answer reorder
 *      which is visual-only — QuizBadgeItem.order column exists on schema).
 *   5. onError: rollback local snapshot + toast localized error.
 *   6. onSuccess: invalidate ['admin.quiz-badges.detail', badgeId] for an
 *      authoritative refresh.
 *
 * Each row: order index, RU title (primary), KZ title (muted), version pill,
 * question_count, status badge, Remove button.
 *
 * "Добавить тест в пробное ЕНТ" button opens AddQuizToBadgeDialog with searchable
 * picker reusing Plan 02's listQuizzes endpoint. The 409 'duplicate_quiz_in_badge'
 * server response is converted to a localized toast inside the dialog.
 */
export interface BadgeItemsEditorProps {
    badgeId: number;
    items: QuizBadgeItemRow[];
}

export function BadgeItemsEditor({ badgeId, items: incoming }: BadgeItemsEditorProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [optimistic, setOptimistic] = useState<QuizBadgeItemRow[]>(incoming);
    const snapshotRef = useRef<QuizBadgeItemRow[] | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<QuizBadgeItemRow | null>(null);

    useEffect(() => {
        setOptimistic(incoming);
    }, [incoming]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    const reorderMutation = useMutation({
        mutationFn: (payload: Array<{ id: number; order: number }>) =>
            reorderBadgeItems(badgeId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.detail', badgeId] });
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
            snapshotRef.current = null;
        },
        onError: (err: Error) => {
            if (snapshotRef.current) {
                setOptimistic(snapshotRef.current);
                snapshotRef.current = null;
            }
            toast.error(err.message || t('save_failed'));
        },
    });

    const removeMutation = useMutation({
        mutationFn: (itemId: number) => removeBadgeItem(badgeId, itemId),
        onSuccess: () => {
            toast.success(t('badge_item_remove_success'));
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.detail', badgeId] });
            qc.invalidateQueries({ queryKey: ['admin.quiz-badges.list'] });
            setDeleteTarget(null);
        },
        onError: (err: Error) => {
            toast.error(err.message || t('generic_error'));
        },
    });

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIdx = optimistic.findIndex((it) => `badge-item-${it.id}` === String(active.id));
        const toIdx = optimistic.findIndex((it) => `badge-item-${it.id}` === String(over.id));
        if (fromIdx === -1 || toIdx === -1) return;

        snapshotRef.current = optimistic;
        const reordered = arrayMove(optimistic, fromIdx, toIdx);
        const next = reordered.map((it, i) => ({ ...it, order: i + 1 }));
        setOptimistic(next);
        reorderMutation.mutate(next.map((it, i) => ({ id: it.id, order: i + 1 })));
    };

    const sortableIds = optimistic.map((it) => `badge-item-${it.id}`);

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between'>
                <div className='text-sm font-semibold'>
                    {t('badge_items_total', { count: optimistic.length })}
                </div>
                <Button type='button' size='sm' onClick={() => setAddOpen(true)}>
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_quiz_to_badge')}
                </Button>
            </div>

            {optimistic.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-6 text-center text-sm'>
                    {t('badge_items_empty')}
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <div className='space-y-2'>
                            {optimistic.map((item, idx) => (
                                <BadgeItemRow
                                    key={item.id}
                                    item={item}
                                    index={idx}
                                    onDelete={() => setDeleteTarget(item)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <AddQuizToBadgeDialog
                badgeId={badgeId}
                open={addOpen}
                onOpenChange={setAddOpen}
                existingQuizIds={optimistic.map((it) => it.quiz_id)}
            />

            <Dialog
                open={deleteTarget != null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{t('badge_item_remove_dialog_title')}</DialogTitle>
                        <DialogDescription>
                            {t('badge_item_remove_dialog_description')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setDeleteTarget(null)}
                            disabled={removeMutation.isPending}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={removeMutation.isPending}
                            onClick={() =>
                                deleteTarget && removeMutation.mutate(deleteTarget.id)
                            }
                        >
                            {removeMutation.isPending
                                ? t('loading')
                                : t('remove_quiz_from_badge')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface BadgeItemRowProps {
    item: QuizBadgeItemRow;
    index: number;
    onDelete: () => void;
}

function BadgeItemRow({ item, index, onDelete }: BadgeItemRowProps) {
    const t = useTranslations('admin.quizzes');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `badge-item-${item.id}`,
        data: { type: 'badge-item', itemId: item.id },
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const ruTitle = item.quiz?.translations.find((tr) => tr.locale === 'ru')?.title ?? '';
    const kzTitle = item.quiz?.translations.find((tr) => tr.locale === 'kz')?.title ?? '';
    const headerLabel = ruTitle.trim().length > 0
        ? ruTitle
        : item.quiz
        ? `#${item.quiz.id}`
        : `#${item.quiz_id}`;

    return (
        <div ref={setNodeRef} style={style}>
            <div className='bg-card flex items-center gap-3 rounded-lg border p-3'>
                <button
                    type='button'
                    className='text-muted-foreground hover:text-foreground cursor-grab touch-none p-1.5'
                    aria-label={t('drag_handle')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className='h-4 w-4' />
                </button>
                <div className='text-muted-foreground w-6 text-right text-sm tabular-nums'>
                    {index + 1}
                </div>
                <div className='min-w-0 flex-1 space-y-1'>
                    <div className='truncate font-medium'>{headerLabel}</div>
                    {kzTitle.length > 0 ? (
                        <div className='text-muted-foreground truncate text-xs'>{kzTitle}</div>
                    ) : null}
                </div>
                {item.quiz ? (
                    <div className='flex shrink-0 items-center gap-2'>
                        <Badge variant='outline' className='font-mono text-xs'>
                            v{item.quiz.version}
                        </Badge>
                        <span className='text-muted-foreground text-xs'>
                            {t('badge_item_question_count', { count: item.quiz.question_count })}
                        </span>
                        <Badge
                            variant={item.quiz.status === 'active' ? 'default' : 'secondary'}
                            className='text-xs'
                        >
                            {item.quiz.status}
                        </Badge>
                    </div>
                ) : (
                    <span className='text-destructive text-xs'>
                        {t('badge_item_quiz_missing')}
                    </span>
                )}
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0'
                    onClick={onDelete}
                    aria-label={t('remove_quiz_from_badge')}
                >
                    <Trash className='h-4 w-4' />
                </Button>
            </div>
        </div>
    );
}
