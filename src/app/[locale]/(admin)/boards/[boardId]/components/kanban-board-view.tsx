'use client';

import { useMemo, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMoveTask } from '@/lib/boards/queries';
import type { BoardColumn, TaskRow } from '@/lib/boards/types';
import { BoardColumnView } from './board-column-view';
import { CreateColumnButton } from './create-column-button';
import { TaskCard } from './task-card';

/**
 * Kanban grid with dnd-kit drag-drop.
 *
 * `over.id` is parsed as either `task-<id>` (drop target is another task) or
 * `column-<id>` (drop target is the column body — used when the column is empty
 * or the user drops below all tasks).
 *
 * Position calculation:
 *   - drop onto a task → insert at that task's current position
 *   - drop onto a column (empty area) → append to the end
 *
 * Same-column reordering also goes through the server (the API does compaction
 * on its end, so the client doesn't need separate "reorder" logic).
 */
export function KanbanBoardView({
    boardId,
    columns,
    tasks,
    onOpenTask,
}: {
    boardId: number;
    columns: BoardColumn[];
    tasks: TaskRow[];
    onOpenTask: (taskId: string) => void;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
    const moveTask = useMoveTask(boardId);

    const tasksByColumn = useMemo(() => {
        const map = new Map<number, TaskRow[]>();
        for (const col of columns) map.set(col.id, []);
        for (const t of tasks) {
            const list = map.get(t.column_id);
            if (list) list.push(t);
        }
        for (const list of map.values()) list.sort((a, b) => a.position - b.position);
        return map;
    }, [columns, tasks]);

    const handleDragStart = (e: DragStartEvent) => {
        const id = String(e.active.id);
        if (id.startsWith('task-')) {
            const taskId = id.slice('task-'.length);
            setActiveTask(tasks.find((t) => t.id === taskId) ?? null);
        }
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveTask(null);
        const { active, over } = e;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        if (!activeId.startsWith('task-')) return;

        const draggedId = activeId.slice('task-'.length);
        const dragged = tasks.find((t) => t.id === draggedId);
        if (!dragged) return;

        let targetColumnId: number;
        let targetPosition: number;

        if (overId.startsWith('column-')) {
            targetColumnId = Number(overId.slice('column-'.length));
            const colTasks = tasksByColumn.get(targetColumnId) ?? [];
            targetPosition = colTasks.filter((t) => t.id !== draggedId).length;
        } else if (overId.startsWith('task-')) {
            const overTaskId = overId.slice('task-'.length);
            const overTask = tasks.find((t) => t.id === overTaskId);
            if (!overTask) return;
            targetColumnId = overTask.column_id;
            targetPosition = overTask.position;
            if (dragged.column_id === targetColumnId && dragged.position < targetPosition) {
                // Moving down within the same column — adjust so we land BELOW the over task.
                targetPosition = overTask.position;
            }
        } else {
            return;
        }

        if (dragged.column_id === targetColumnId && dragged.position === targetPosition) return;

        moveTask.mutate({ taskId: draggedId, payload: { column_id: targetColumnId, position: targetPosition } });
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
        >
            <div className="flex h-full gap-3 overflow-x-auto px-6 py-4">
                {columns.map((col) => (
                    <SortableContext
                        key={col.id}
                        id={`column-${col.id}`}
                        items={(tasksByColumn.get(col.id) ?? []).map((t) => `task-${t.id}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <BoardColumnView
                            boardId={boardId}
                            column={col}
                            tasks={tasksByColumn.get(col.id) ?? []}
                            onOpenTask={onOpenTask}
                        />
                    </SortableContext>
                ))}
                <CreateColumnButton boardId={boardId} />
            </div>

            <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging /> : null}</DragOverlay>
        </DndContext>
    );
}
