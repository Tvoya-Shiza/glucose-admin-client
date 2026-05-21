/**
 * Phase 18 — client-side mirror of glucose-admin-api course-access DTOs.
 *
 * Keep in lockstep with:
 *   glucose-admin-api/src/modules/course-access/dto/course-grant-row.dto.ts
 *   glucose-admin-api/src/modules/course-access/dto/grant-user-access.dto.ts
 *   glucose-admin-api/src/modules/course-access/dto/grant-group-access.dto.ts
 *   glucose-admin-api/src/modules/course-access/dto/extend-access.dto.ts
 */

export interface CourseRef {
    id: number;
    title: string;
    slug: string;
}

export interface GrantedByRef {
    id: number;
    full_name: string | null;
}

export interface CourseGrantRow {
    sale_id: number;
    course: CourseRef;
    granted_at: number; // Unix sec
    expires_at: number | null; // Unix sec; null = perpetual
    days_remaining: number | null; // 0 when expired; null when perpetual
    is_active: boolean;
    granted_by: GrantedByRef | null;
    refund_at: number | null;
}

export interface GroupGrantsListResponse {
    rows: CourseGrantRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface ListGroupGrantsQuery {
    page?: number;
    page_size?: number;
    only_active?: boolean;
}

export interface GrantUserAccessBody {
    webinar_id: number;
    /** Unix sec; null/omitted = perpetual. */
    expires_at?: number | null;
}

export interface GrantGroupAccessBody {
    webinar_id: number;
    expires_at?: number | null;
}

export interface ExtendAccessBody {
    /** Unix sec; null = perpetual. */
    expires_at: number | null;
}

export interface CreatedGrant {
    sale_id: number;
    target_type: 'user' | 'group';
    target_id: number;
    webinar_id: number;
    access_days: number | null;
    expires_at: number | null;
    created_at: number;
}

export interface ExtendedGrant {
    sale_id: number;
    access_days: number | null;
    expires_at: number | null;
    previous_access_days: number | null;
}

export interface RevokedGrant {
    sale_id: number;
    refund_at: number;
}

// ---------------------------------------------------------------------------
// Feature C — Course → Accessors tab (Phase 19 / PR-5)
// ---------------------------------------------------------------------------

export interface AccessorUserRef {
    id: number;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
}

export interface AccessorSourceRef {
    kind: 'direct' | 'group';
    group_id: number | null;
    group_name: string | null;
}

export interface CourseAccessorRow {
    user: AccessorUserRef;
    source: AccessorSourceRef;
    /** Sale.id — handle for PATCH / DELETE /sales/:saleId/access (extend / revoke).
     *  For group rows it is the group's grant sale (shared across members) —
     *  the UI should disable extend/revoke buttons on group rows. */
    sale_id: number;
    granted_at: number;
    expires_at: number | null;
    days_remaining: number | null;
    last_course_activity: number | null;
    is_active: boolean;
}

export interface CourseAccessorsListResponse {
    rows: CourseAccessorRow[];
    total: number;
    page: number;
    page_size: number;
}

export type AccessorSortField = 'granted_at' | 'expires_at' | 'last_activity' | 'full_name';

export interface ListCourseAccessorsQuery {
    page?: number;
    page_size?: number;
    q?: string;
    group_id?: number;
    source?: 'direct' | 'group';
    sort?: AccessorSortField;
    order?: 'asc' | 'desc';
}

export interface CourseAccessorsSummary {
    total: number;
    direct_count: number;
    via_group_count: number;
    groups_count: number;
    active_last_7d: number;
}
