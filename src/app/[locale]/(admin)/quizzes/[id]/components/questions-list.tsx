'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { reorderQuestions } from '@/lib/quizzes/api';
import type { QuestionDetail } from '@/lib/quizzes/types';
import { QuestionRow } from './question-row';
import { UpsertQuestionDialog } from './upsert-question-dialog';

/**
 * QuestionsList — dnd-kit sortable list of questions for a quiz (Plan 05).
 *
 * Mirrors Phase 5 chapter-tree-editor.tsx pattern (single-level here):
 *   1. Snapshot pre-drag rows[] for rollback.
 *   2. Apply move locally (immediate visual feedback).
 *   3. Build full items[] payload (id + new order).
 *   4. Call reorderQuestions mutation. NOT destructive — no version bump
 *      (D-11). No 409 force_confirm risk.
 *   5. onError: rollback local + toast localized error.
 *   6. onSuccess: invalidate cache for authoritative refresh.
 *
 * Add Question button: opens UpsertQuestionDialog in create mode. The CREATE
 * path is non-destructive (additive per D-11) and never triggers 409.
 */
export interface QuestionsListProps {
    quizId: number;
    questions: QuestionDetail[];
}

export function QuestionsList({ quizId, questions: incoming }: QuestionsListProps) {
    const t = useTranslations('admin.quizzes');
    const qc = useQueryClient();

    const [optimistic, setOptimistic] = useState<QuestionDetail[]>(incoming);
    const snapshotRef = useRef<QuestionDetail[] | null>(null);
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        setOptimistic(incoming);
    }, [incoming]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    const reorderMutation = useMutation({
        mutationFn: (items: Array<{ id: number; order: number }>) =>
            reorderQuestions(quizId, items),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin.quizzes.questions', quizId] });
            qc.invalidateQueries({ queryKey: ['admin.quizzes.detail', quizId] });
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

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const fromIdx = optimistic.findIndex((q) => `question-${q.id}` === String(active.id));
        const toIdx = optimistic.findIndex((q) => `question-${q.id}` === String(over.id));
        if (fromIdx === -1 || toIdx === -1) return;

        snapshotRef.current = optimistic;
        const reordered = arrayMove(optimistic, fromIdx, toIdx);
        const next = reordered.map((q, i) => ({ ...q, order: i + 1 }));
        setOptimistic(next);
        reorderMutation.mutate(next.map((q, i) => ({ id: q.id, order: i + 1 })));
    };

    const sortableIds = optimistic.map((q) => `question-${q.id}`);

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <div className='text-sm font-semibold'>
                    {t('questions_total', { count: optimistic.length })}
                </div>
                <Button type='button' size='sm' onClick={() => setCreateOpen(true)}>
                    <Plus className='mr-1 h-4 w-4' />
                    {t('add_question')}
                </Button>
            </div>

            {optimistic.length === 0 ? (
                <div className='text-muted-foreground rounded border border-dashed p-6 text-center text-sm'>
                    {t('no_questions_yet')}
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                        <div className='space-y-2'>
                            {optimistic.map((q, idx) => (
                                <QuestionRow key={q.id} quizId={quizId} question={q} index={idx} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {createOpen ? (
                <UpsertQuestionDialog
                    quizId={quizId}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    question={null}
                />
            ) : null}
        </div>
    );
}
