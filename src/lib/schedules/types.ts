export const SCHEDULE_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const SCHEDULE_KINDS = ['lesson', 'quiz', 'assignment', 'file'] as const;
export type ScheduleItemKind = (typeof SCHEDULE_KINDS)[number];

export interface ScheduleItem {
    id: number;
    kind: ScheduleItemKind;
    ref_id: number;
    position: number;
    title_ru: string | null;
    title_kz: string | null;
    resolved: boolean;
}

export interface Schedule {
    id: number;
    curator_id: number;
    curator_name: string | null;
    /** Phase 32 — null for a GENERAL schedule (applies to all students of the course). */
    group_id: number | null;
    group_name: string | null;
    course_id: number | null;
    course_title_ru: string | null;
    course_title_kz: string | null;
    start_at: number;
    end_at: number;
    description: string | null;
    status: ScheduleStatus;
    /** Phase 32 — independent access-gate toggles. */
    block_before_start: boolean;
    block_after_end: boolean;
    item_count: number;
    items: ScheduleItem[];
    created_by: number;
    created_at: number;
    updated_at: number | null;
}

export interface ScheduleListResponse {
    rows: Schedule[];
    total: number;
    page: number;
    page_size: number;
}

export interface ScheduleCalendarResponse {
    rows: Schedule[];
    from: number;
    to: number;
}

export interface ScheduleAnalytics {
    total: number;
    by_status: Record<ScheduleStatus, number>;
    by_kind: Record<ScheduleItemKind, number>;
    upcoming_7d: number;
    overdue_count: number;
    top_curators: Array<{ curator_id: number; curator_name: string | null; count: number }>;
    sparkline: Array<{ bucket: number; count: number }>;
}

export interface ScheduleItemInput {
    kind: ScheduleItemKind;
    ref_id: number;
    position?: number;
}

export interface ScheduleListFilters {
    page?: number;
    page_size?: number;
    q?: string;
    status?: ScheduleStatus;
    curator_id?: number;
    group_id?: number;
    course_id?: number;
    kind?: ScheduleItemKind;
    from?: number;
    to?: number;
    sort?: 'start_at' | 'created_at';
    order?: 'asc' | 'desc';
}

export interface CreateSchedulePayload {
    curator_id: number;
    /** null = general schedule (applies to all students of the course). */
    group_id: number | null;
    course_id: number;
    start_at: number;
    end_at: number;
    description?: string | null;
    status?: ScheduleStatus;
    block_before_start?: boolean;
    block_after_end?: boolean;
    items?: ScheduleItemInput[];
}

export interface UpdateSchedulePayload {
    /** null converts a group schedule to general; omitted leaves it unchanged. */
    group_id?: number | null;
    course_id?: number;
    start_at?: number;
    end_at?: number;
    description?: string | null;
    status?: ScheduleStatus;
    block_before_start?: boolean;
    block_after_end?: boolean;
    items?: ScheduleItemInput[];
}
