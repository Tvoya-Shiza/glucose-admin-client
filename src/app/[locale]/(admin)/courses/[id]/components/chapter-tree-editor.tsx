'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { reorderCourse } from '@/lib/courses/api';
import type { Chapter, ChapterItem, ReorderPayload } from '@/lib/courses/types';
import { ChapterRow } from './chapter-row';

/**
 * ChapterTreeEditor — dnd-kit 2-level tree editor (CRS-03 / CONTEXT D-07/D-08).
 *
 * Drag types (encoded in the sortable id prefix + data.type):
 *   - 'chapter-<id>'  → chapter row at top level
 *   - 'item-<id>'     → item row nested inside a chapter
 *
 * Two SortableContext instances:
 *   - Outer: top-level chapter ids (verticalListSortingStrategy)
 *   - Inner: per-chapter, item ids (rendered by ChapterRow itself)
 *
 * onDragEnd resolves:
 *   - chapter ↔ chapter → reorder chapters[]
 *   - item    ↔ item    → reorder within OR across chapters (depending on container)
 *   - item    ↔ chapter → drop item into the chapter's items list (dropping on the
 *                          chapter row itself = append to that chapter's items)
 *
 * Optimistic UI:
 *   1. Snapshot pre-drag chapters[] (from React Query cache + local mirror).
 *   2. Apply move locally (immediate visual feedback).
 *   3. Build the reorder payload (full chapters+items arrays for simplicity per
 *      plan body — server's @ArrayMaxSize tolerates this for reasonable courses).
 *   4. Call reorderCourse mutation.
 *   5. onError: rollback local state + toast (CONTEXT specifics — "Reorder failed
 *      — restoring previous order").
 *   6. onSuccess: invalidate detail cache for an authoritative refresh.
 */

interface ChapterTreeEditorProps {
    courseId: number;
    chapters: Chapter[];
}

export function ChapterTreeEditor({ courseId, chapters: incoming }: ChapterTreeEditorProps) {
    const t = useTranslations('admin.courses');
    const qc = useQueryClient();
    // Local mirror for optimistic edits — synced from props whenever upstream changes.
    const [optimistic, setOptimistic] = useState<Chapter[]>(incoming);
    const snapshotRef = useRef<Chapter[] | null>(null);

    useEffect(() => {
        setOptimistic(incoming);
    }, [incoming]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    const mutation = useMutation({
        mutationFn: (payload: ReorderPayload) => reorderCourse(courseId, payload),
        onSuccess: () => {
            toast.success(t('reorder_saved'));
            qc.invalidateQueries({ queryKey: ['admin.courses.detail', courseId] });
            snapshotRef.current = null;
        },
        onError: (err: Error) => {
            // Rollback to pre-drag snapshot.
            if (snapshotRef.current) {
                setOptimistic(snapshotRef.current);
                snapshotRef.current = null;
            }
            toast.error(err.message ? `${t('reorder_failed_restoring')}: ${err.message}` : t('reorder_failed_restoring'));
        },
    });

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        const activeData = active.data.current as { type?: string; chapterId?: number; itemId?: number } | undefined;
        const overData = over.data.current as { type?: string; chapterId?: number; itemId?: number } | undefined;

        // Snapshot for rollback.
        snapshotRef.current = optimistic;

        // ---- Chapter-level reorder ----
        if (activeData?.type === 'chapter' && (overData?.type === 'chapter' || overId.startsWith('chapter-'))) {
            const fromIdx = optimistic.findIndex((c) => `chapter-${c.id}` === activeId);
            const toIdx = optimistic.findIndex((c) => `chapter-${c.id}` === overId);
            if (fromIdx === -1 || toIdx === -1) return;
            const reordered = arrayMove(optimistic, fromIdx, toIdx);
            const next = reordered.map((c, idx) => ({ ...c, order: idx + 1 }));
            setOptimistic(next);

            const payload: ReorderPayload = {
                chapters: next.map((c) => ({ id: c.id, order: c.order ?? 0 })),
            };
            mutation.mutate(payload);
            return;
        }

        // ---- Item drag ----
        if (activeData?.type !== 'item') return;
        const activeItemId = activeData.itemId!;
        const fromChapterId = activeData.chapterId!;

        // Find which chapter currently owns the active item (use props/optimistic for source of truth).
        const sourceChapterIdx = optimistic.findIndex((c) => c.items.some((i) => i.id === activeItemId));
        if (sourceChapterIdx === -1) return;
        const sourceChapter = optimistic[sourceChapterIdx]!;
        const activeIdxInSource = sourceChapter.items.findIndex((i) => i.id === activeItemId);

        // Resolve target chapter + insertion index.
        let targetChapterIdx = -1;
        let insertAt = -1;
        if (overData?.type === 'item') {
            // Dropped onto another item — same or different chapter.
            const overItemId = overData.itemId!;
            targetChapterIdx = optimistic.findIndex((c) => c.items.some((i) => i.id === overItemId));
            if (targetChapterIdx === -1) return;
            insertAt = optimistic[targetChapterIdx]!.items.findIndex((i) => i.id === overItemId);
        } else if (overData?.type === 'chapter') {
            // Dropped onto a chapter row — append to that chapter.
            const overChapterId = overData.chapterId!;
            targetChapterIdx = optimistic.findIndex((c) => c.id === overChapterId);
            if (targetChapterIdx === -1) return;
            insertAt = optimistic[targetChapterIdx]!.items.length;
        } else {
            return;
        }

        // Build the new chapters array.
        const next = optimistic.map((c) => ({ ...c, items: [...c.items] }));
        const sourceClone = next[sourceChapterIdx]!;
        const movedArr = sourceClone.items.splice(activeIdxInSource, 1);
        const moving = movedArr[0];
        if (!moving) return;

        const targetClone = next[targetChapterIdx]!;
        if (sourceChapterIdx === targetChapterIdx) {
            // Same chapter — insertAt may shift if the source is before the target.
            const adjusted = activeIdxInSource < insertAt ? insertAt - 1 : insertAt;
            targetClone.items.splice(Math.max(0, adjusted), 0, moving);
        } else {
            const updatedMoving: ChapterItem = { ...moving };
            targetClone.items.splice(Math.max(0, insertAt), 0, updatedMoving);
        }

        // Re-number orders inside affected chapters.
        targetClone.items = targetClone.items.map((it, idx) => ({ ...it, order: idx + 1 }));
        if (sourceChapterIdx !== targetChapterIdx) {
            sourceClone.items = sourceClone.items.map((it, idx) => ({ ...it, order: idx + 1 }));
        }

        setOptimistic(next);

        // Build the reorder payload — only items (chapter order unchanged).
        const itemsPayload = next.flatMap((c) =>
            c.items.map((it) => ({
                id: it.id,
                chapter_id: c.id,
                order: it.order ?? 0,
            })),
        );
        // Filter to only items that actually changed chapter or order to keep payload small.
        // For simplicity (per plan body trade-off) send all.
        mutation.mutate({ items: itemsPayload });
        // suppress unused param warning for fromChapterId — exposed for future logging.
        void fromChapterId;
    };

    const chapterSortableIds = optimistic.map((c) => `chapter-${c.id}`);

    if (optimistic.length === 0) {
        return (
            <div className='text-muted-foreground rounded border border-dashed p-6 text-center'>
                {t('no_chapters_yet')}
            </div>
        );
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={chapterSortableIds} strategy={verticalListSortingStrategy}>
                <div className='space-y-3'>
                    {optimistic.map((c) => (
                        <ChapterRow key={c.id} courseId={courseId} chapter={c} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
