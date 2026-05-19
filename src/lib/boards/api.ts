import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BoardDetail,
    BoardListResponse,
    BoardMember,
    BoardRow,
    CreateBoardPayload,
    CreateColumnPayload,
    CreateTaskPayload,
    ListBoardsQuery,
    ListTasksQuery,
    MoveTaskPayload,
    ReorderColumnsPayload,
    SetBoardMembersPayload,
    SetTaskAssigneesPayload,
    TaskAssigneeRow,
    TaskDetail,
    TaskListResponse,
    UpdateBoardPayload,
    UpdateColumnPayload,
    UpdateTaskPayload,
} from './types';

/**
 * Typed wrappers around the admin-api Phase 12 boards endpoints.
 *
 * All calls route through the BFF proxy `/api/proxy/v1/admin/boards/*` —
 * browser never hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy"
 * forbidden). The proxy attaches the access token as Bearer server-to-server.
 *
 * Response shapes:
 *   - List endpoints (GET /, GET /:id/tasks) return the raw `{ rows, total, ... }` shape.
 *   - Mutation endpoints (POST/PATCH/PUT/DELETE) wrap in `apiResponse({...,data})` —
 *     unwrap with `json?.data ?? json` per the users-module precedent.
 */

const BASE = '/api/proxy/v1/admin/boards';

function buildQuery(q: object | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

async function unwrap<T>(res: Response, label: string): Promise<T> {
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as T;
}

// -- Boards ------------------------------------------------------------------

export async function listBoards(q?: ListBoardsQuery): Promise<BoardListResponse> {
    const res = await fetchWithRefresh(`${BASE}${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listBoards failed: ${res.status}`);
    return res.json();
}

export async function getBoard(id: number): Promise<BoardDetail> {
    const res = await fetchWithRefresh(`${BASE}/${id}`);
    return unwrap(res, 'getBoard');
}

export async function createBoard(payload: CreateBoardPayload): Promise<BoardRow> {
    const res = await fetchWithRefresh(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'createBoard');
}

export async function updateBoard(id: number, payload: UpdateBoardPayload): Promise<BoardRow> {
    const res = await fetchWithRefresh(`${BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'updateBoard');
}

export async function deleteBoard(id: number): Promise<{ ok: true }> {
    const res = await fetchWithRefresh(`${BASE}/${id}`, { method: 'DELETE' });
    return unwrap(res, 'deleteBoard');
}

// -- Members -----------------------------------------------------------------

export async function listBoardMembers(boardId: number): Promise<{ rows: BoardMember[] }> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/members`);
    return unwrap(res, 'listBoardMembers');
}

export async function setBoardMembers(
    boardId: number,
    payload: SetBoardMembersPayload,
): Promise<{ rows: BoardMember[] }> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'setBoardMembers');
}

// -- Columns -----------------------------------------------------------------

export async function createColumn(boardId: number, payload: CreateColumnPayload) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'createColumn');
}

export async function updateColumn(boardId: number, columnId: number, payload: UpdateColumnPayload) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'updateColumn');
}

export async function deleteColumn(boardId: number, columnId: number) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/columns/${columnId}`, { method: 'DELETE' });
    return unwrap(res, 'deleteColumn');
}

export async function reorderColumns(boardId: number, payload: ReorderColumnsPayload) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/columns/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'reorderColumns');
}

// -- Tasks -------------------------------------------------------------------

export async function listBoardTasks(boardId: number, q?: ListTasksQuery): Promise<TaskListResponse> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listBoardTasks failed: ${res.status}`);
    return res.json();
}

export async function getTask(boardId: number, taskId: string): Promise<TaskDetail> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}`);
    return unwrap(res, 'getTask');
}

export async function createTask(boardId: number, payload: CreateTaskPayload): Promise<TaskDetail> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'createTask');
}

export async function updateTask(boardId: number, taskId: string, payload: UpdateTaskPayload): Promise<TaskDetail> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'updateTask');
}

export async function moveTask(boardId: number, taskId: string, payload: MoveTaskPayload) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'moveTask');
}

export async function deleteTask(boardId: number, taskId: string) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
    });
    return unwrap(res, 'deleteTask');
}

export async function setTaskAssignees(
    boardId: number,
    taskId: string,
    payload: SetTaskAssigneesPayload,
): Promise<{ ok: true; rows: TaskAssigneeRow[] }> {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/assignees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return unwrap(res, 'setTaskAssignees');
}

// -- Comments / checklist / attachments (Phase 4) ----------------------------

export async function createTaskComment(boardId: number, taskId: string, content: string) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    return unwrap(res, 'createTaskComment');
}

export async function deleteTaskComment(boardId: number, taskId: string, commentId: string) {
    const res = await fetchWithRefresh(
        `${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`,
        { method: 'DELETE' },
    );
    return unwrap(res, 'deleteTaskComment');
}

export async function createChecklistItem(boardId: number, taskId: string, title: string) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
    });
    return unwrap(res, 'createChecklistItem');
}

export async function updateChecklistItem(
    boardId: number,
    taskId: string,
    itemId: number,
    payload: { title?: string; is_done?: boolean },
) {
    const res = await fetchWithRefresh(
        `${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/checklist/${itemId}`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
    );
    return unwrap(res, 'updateChecklistItem');
}

export async function deleteChecklistItem(boardId: number, taskId: string, itemId: number) {
    const res = await fetchWithRefresh(
        `${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/checklist/${itemId}`,
        { method: 'DELETE' },
    );
    return unwrap(res, 'deleteChecklistItem');
}

export async function addTaskAttachment(boardId: number, taskId: string, uploadAssetId: string) {
    const res = await fetchWithRefresh(`${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_asset_id: uploadAssetId }),
    });
    return unwrap(res, 'addTaskAttachment');
}

export async function removeTaskAttachment(boardId: number, taskId: string, attachmentId: number) {
    const res = await fetchWithRefresh(
        `${BASE}/${boardId}/tasks/${encodeURIComponent(taskId)}/attachments/${attachmentId}`,
        { method: 'DELETE' },
    );
    return unwrap(res, 'removeTaskAttachment');
}
