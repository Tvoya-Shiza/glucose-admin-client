/**
 * Type-level mirror of the admin-api boards module DTOs.
 *
 * Kept in sync by hand. The admin-api is authoritative — these are TypeScript
 * helpers for the consumer side only and never travel over the wire as a
 * contract definition. If admin-api changes a field name, update both sides
 * in the same PR.
 */

export type BoardStatus = 'active' | 'archived';
export type BoardMemberRole = 'owner' | 'editor' | 'viewer';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AssigneeType = 'user' | 'role' | 'group' | 'everyone';

export interface BoardRow {
    id: number;
    creator_id: number;
    name: string;
    description: string | null;
    color: string | null;
    status: BoardStatus;
    created_at: number;
    updated_at: number | null;
    member_count: number;
    task_count: number;
}

export interface BoardListResponse {
    rows: BoardRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface BoardColumn {
    id: number;
    name: string;
    color: string | null;
    position: number;
    wip_limit: number | null;
    is_done_column: boolean;
}

export interface BoardDetail extends Omit<BoardRow, 'member_count' | 'task_count'> {
    member_count: number;
    task_count: number;
    columns: BoardColumn[];
}

export interface BoardMember {
    id: number;
    board_id: number;
    user_id: number;
    role: BoardMemberRole;
    added_by: number;
    created_at: number;
}

export interface TaskAssigneeRow {
    id: number;
    assignee_type: AssigneeType;
    assignee_id: number | null;
    assigned_by: number;
    created_at: number;
}

export interface TaskRow {
    id: string; // BigInt-as-string per CLAUDE.md
    board_id: number;
    column_id: number;
    creator_id: number;
    title: string;
    position: number;
    priority: TaskPriority;
    due_at: number | null;
    completed_at: number | null;
    created_at: number;
    updated_at: number | null;
    assignee_count: number;
    comment_count: number;
    attachment_count: number;
    checklist_total: number;
    checklist_done: number;
    assignees: Array<{ assignee_type: AssigneeType; assignee_id: number | null }>;
}

export interface ChecklistItem {
    id: number;
    title: string;
    is_done: boolean;
    position: number;
    completed_by: number | null;
    completed_at: number | null;
}

export interface TaskAttachment {
    id: number;
    upload_asset_id: string;
    uploaded_by: number;
    created_at: number;
}

export interface TaskComment {
    id: string;
    author_id: number;
    content: string;
    created_at: number;
    updated_at: number | null;
}

export interface TaskActivityEntry {
    id: string;
    actor_id: number;
    action: string;
    payload: unknown;
    created_at: number;
}

export interface TaskDetail extends Omit<TaskRow, 'assignee_count' | 'comment_count' | 'attachment_count' | 'checklist_total' | 'checklist_done' | 'assignees'> {
    description: string | null;
    assignees: TaskAssigneeRow[];
    checklist: ChecklistItem[];
    attachments: TaskAttachment[];
    comments: TaskComment[];
    activity: TaskActivityEntry[];
}

export interface TaskListResponse {
    rows: TaskRow[];
}

// -- Request DTOs ------------------------------------------------------------

export interface CreateBoardPayload {
    name: string;
    description?: string;
    color?: string;
}

export interface UpdateBoardPayload {
    name?: string;
    description?: string | null;
    color?: string | null;
    status?: BoardStatus;
}

export interface CreateColumnPayload {
    name: string;
    color?: string;
    position?: number;
    wip_limit?: number;
    is_done_column?: boolean;
}

export interface UpdateColumnPayload {
    name?: string;
    color?: string | null;
    wip_limit?: number | null;
    is_done_column?: boolean;
}

export interface ReorderColumnsPayload {
    items: Array<{ id: number; position: number }>;
}

export interface TaskAssigneePayload {
    assignee_type: AssigneeType;
    assignee_id?: number;
}

export interface CreateTaskPayload {
    title: string;
    description?: string;
    column_id?: number;
    priority?: TaskPriority;
    due_at?: number;
    assignees?: TaskAssigneePayload[];
}

export interface UpdateTaskPayload {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    due_at?: number | null;
    completed?: boolean;
}

export interface MoveTaskPayload {
    column_id: number;
    position: number;
}

export interface SetTaskAssigneesPayload {
    assignees: TaskAssigneePayload[];
}

export interface SetBoardMembersPayload {
    members: Array<{ user_id: number; role: BoardMemberRole }>;
}

export interface ListBoardsQuery {
    page?: number;
    page_size?: number;
    status?: BoardStatus | 'all';
    q?: string;
    sort?: 'created_at' | 'name';
    order?: 'asc' | 'desc';
}

export interface ListTasksQuery {
    column_id?: number;
    priority?: TaskPriority;
    filter?: 'mine' | 'created' | 'overdue' | 'completed' | 'all';
    q?: string;
    due_before?: number;
}
