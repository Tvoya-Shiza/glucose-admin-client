'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    addTaskAttachment,
    createBoard,
    createChecklistItem,
    createColumn,
    createTask,
    createTaskComment,
    deleteBoard,
    deleteChecklistItem,
    deleteColumn,
    deleteTask,
    deleteTaskComment,
    getBoard,
    getTask,
    listBoardMembers,
    listBoardTasks,
    listBoards,
    moveTask,
    removeTaskAttachment,
    reorderColumns,
    setBoardMembers,
    setTaskAssignees,
    updateBoard,
    updateChecklistItem,
    updateColumn,
    updateTask,
} from './api';
import type {
    BoardDetail,
    CreateBoardPayload,
    CreateColumnPayload,
    CreateTaskPayload,
    ListBoardsQuery,
    ListTasksQuery,
    MoveTaskPayload,
    ReorderColumnsPayload,
    SetBoardMembersPayload,
    SetTaskAssigneesPayload,
    TaskListResponse,
    UpdateBoardPayload,
    UpdateColumnPayload,
    UpdateTaskPayload,
} from './types';

/**
 * Centralised TanStack Query keys + hooks for the boards/tasks feature.
 *
 * Hook layout intentionally mirrors the wire: `useBoards()` for the list, `useBoard()`
 * for detail (board + columns), `useBoardTasks()` for the task grid, `useTask()` for
 * the detail dialog. Each mutation hook does optimistic updates where it pays off
 * (drag-drop is the obvious case) and falls back to query-invalidation otherwise.
 */
export const boardKeys = {
    all: ['boards'] as const,
    lists: () => [...boardKeys.all, 'list'] as const,
    list: (q?: ListBoardsQuery) => [...boardKeys.lists(), q ?? {}] as const,
    detail: (id: number) => [...boardKeys.all, 'detail', id] as const,
    members: (id: number) => [...boardKeys.all, 'members', id] as const,
    tasks: (id: number, q?: ListTasksQuery) => [...boardKeys.all, id, 'tasks', q ?? {}] as const,
    task: (boardId: number, taskId: string) => [...boardKeys.all, boardId, 'task', taskId] as const,
};

// -- Boards ------------------------------------------------------------------

export function useBoards(q?: ListBoardsQuery) {
    return useQuery({
        queryKey: boardKeys.list(q),
        queryFn: () => listBoards(q),
        staleTime: 15_000,
    });
}

export function useBoard(id: number, enabled = true) {
    return useQuery({
        queryKey: boardKeys.detail(id),
        queryFn: () => getBoard(id),
        enabled: enabled && Number.isFinite(id) && id > 0,
        staleTime: 15_000,
    });
}

export function useCreateBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateBoardPayload) => createBoard(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.lists() }),
    });
}

export function useUpdateBoard(id: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateBoardPayload) => updateBoard(id, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKeys.lists() });
            qc.invalidateQueries({ queryKey: boardKeys.detail(id) });
        },
    });
}

export function useDeleteBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteBoard(id),
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: boardKeys.lists() });
            qc.removeQueries({ queryKey: boardKeys.detail(id) });
        },
    });
}

// -- Members -----------------------------------------------------------------

export function useBoardMembers(boardId: number, enabled = true) {
    return useQuery({
        queryKey: boardKeys.members(boardId),
        queryFn: () => listBoardMembers(boardId),
        enabled,
    });
}

export function useSetBoardMembers(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: SetBoardMembersPayload) => setBoardMembers(boardId, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.members(boardId) }),
    });
}

// -- Columns -----------------------------------------------------------------

export function useCreateColumn(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateColumnPayload) => createColumn(boardId, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) }),
    });
}

export function useUpdateColumn(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ columnId, payload }: { columnId: number; payload: UpdateColumnPayload }) =>
            updateColumn(boardId, columnId, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) }),
    });
}

export function useDeleteColumn(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (columnId: number) => deleteColumn(boardId, columnId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
            qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
        },
    });
}

export function useReorderColumns(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: ReorderColumnsPayload) => reorderColumns(boardId, payload),
        // Optimistic: rewrite the cached BoardDetail with the new positions immediately.
        onMutate: async (payload) => {
            await qc.cancelQueries({ queryKey: boardKeys.detail(boardId) });
            const prev = qc.getQueryData<BoardDetail>(boardKeys.detail(boardId));
            if (prev) {
                const pos = new Map(payload.items.map((i) => [i.id, i.position]));
                qc.setQueryData<BoardDetail>(boardKeys.detail(boardId), {
                    ...prev,
                    columns: prev.columns
                        .map((c) => ({ ...c, position: pos.get(c.id) ?? c.position }))
                        .sort((a, b) => a.position - b.position),
                });
            }
            return { prev };
        },
        onError: (_err, _payload, ctx) => {
            if (ctx?.prev) qc.setQueryData(boardKeys.detail(boardId), ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) }),
    });
}

// -- Tasks -------------------------------------------------------------------

export function useBoardTasks(boardId: number, q?: ListTasksQuery, enabled = true) {
    return useQuery({
        queryKey: boardKeys.tasks(boardId, q),
        queryFn: () => listBoardTasks(boardId, q),
        enabled: enabled && Number.isFinite(boardId) && boardId > 0,
        staleTime: 5_000,
    });
}

export function useTask(boardId: number, taskId: string | null) {
    return useQuery({
        queryKey: boardKeys.task(boardId, taskId ?? ''),
        queryFn: () => getTask(boardId, taskId!),
        enabled: !!taskId,
        staleTime: 5_000,
    });
}

export function useCreateTask(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateTaskPayload) => createTask(boardId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
            qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
        },
    });
}

export function useUpdateTask(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateTaskPayload) => updateTask(boardId, taskId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKeys.task(boardId, taskId) });
            qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
        },
    });
}

export function useDeleteTask(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (taskId: string) => deleteTask(boardId, taskId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
            qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
        },
    });
}

/**
 * Drag-drop mutation. Eagerly rewrites the cached task list so the card stays
 * where the user dropped it; rolls back on error.
 */
export function useMoveTask(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ taskId, payload }: { taskId: string; payload: MoveTaskPayload }) =>
            moveTask(boardId, taskId, payload),
        onMutate: async ({ taskId, payload }) => {
            const listKeyPrefix = [...boardKeys.all, boardId, 'tasks'] as const;
            await qc.cancelQueries({ queryKey: listKeyPrefix });
            const previousLists: Array<{ key: readonly unknown[]; data: TaskListResponse }> = [];
            const queries = qc.getQueriesData<TaskListResponse>({ queryKey: listKeyPrefix });
            for (const [key, data] of queries) {
                if (!data) continue;
                previousLists.push({ key, data });
                qc.setQueryData<TaskListResponse>(key, applyOptimisticMove(data, taskId, payload));
            }
            return { previousLists };
        },
        onError: (_err, _vars, ctx) => {
            for (const snap of ctx?.previousLists ?? []) {
                qc.setQueryData(snap.key, snap.data);
            }
        },
        onSettled: () => qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] }),
    });
}

function applyOptimisticMove(data: TaskListResponse, taskId: string, payload: MoveTaskPayload): TaskListResponse {
    const target = data.rows.find((r) => r.id === taskId);
    if (!target) return data;
    const fromColumn = target.column_id;
    const toColumn = payload.column_id;
    const sameColumn = fromColumn === toColumn;

    const rows = data.rows.map((r) => {
        if (r.id === taskId) return { ...r, column_id: toColumn, position: payload.position };
        // Vacate source: anything in fromColumn with position > target.position shifts up.
        if (!sameColumn && r.column_id === fromColumn && r.position > target.position) {
            return { ...r, position: r.position - 1 };
        }
        // Make room in target: anything in toColumn with position >= payload.position shifts down,
        // skipping the moving task itself.
        if (r.column_id === toColumn && r.id !== taskId && r.position >= payload.position) {
            return { ...r, position: r.position + 1 };
        }
        return r;
    });

    return { ...data, rows };
}

export function useSetTaskAssignees(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: SetTaskAssigneesPayload) => setTaskAssignees(boardId, taskId, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: boardKeys.task(boardId, taskId) });
            qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
        },
    });
}

// -- Comments / checklist / attachments (Phase 4) ---------------------------

function invalidateTaskAndList(qc: ReturnType<typeof useQueryClient>, boardId: number, taskId: string) {
    qc.invalidateQueries({ queryKey: boardKeys.task(boardId, taskId) });
    qc.invalidateQueries({ queryKey: [...boardKeys.all, boardId, 'tasks'] });
}

export function useCreateTaskComment(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (content: string) => createTaskComment(boardId, taskId, content),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useDeleteTaskComment(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (commentId: string) => deleteTaskComment(boardId, taskId, commentId),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useCreateChecklistItem(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (title: string) => createChecklistItem(boardId, taskId, title),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useUpdateChecklistItem(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ itemId, payload }: { itemId: number; payload: { title?: string; is_done?: boolean } }) =>
            updateChecklistItem(boardId, taskId, itemId, payload),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useDeleteChecklistItem(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (itemId: number) => deleteChecklistItem(boardId, taskId, itemId),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useAddTaskAttachment(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uploadAssetId: string) => addTaskAttachment(boardId, taskId, uploadAssetId),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}

export function useRemoveTaskAttachment(boardId: number, taskId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (attachmentId: number) => removeTaskAttachment(boardId, taskId, attachmentId),
        onSuccess: () => invalidateTaskAndList(qc, boardId, taskId),
    });
}
