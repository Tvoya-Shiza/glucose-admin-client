/**
 * TS types mirroring admin-api UserRowDto / UserListResponseDto / UserDetail shapes.
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/users/dto/{list-users,user-row}.dto.ts.
 *
 * BigInt note (per glucose-admin-client/CLAUDE.md "BigInt-as-string"): when admin-api
 * exposes BigInt columns as strings, mirror them as `string` here. User.id in this
 * schema is `Int`, so `number` is safe. If a future column lands as BigInt, switch
 * the relevant field's type in lockstep with the admin-api DTO change.
 */

export type UserStatus = 'active' | 'inactive' | 'pending';
export type StaffRoleName = 'admin' | 'curator' | 'teacher';
export type AnyRoleName = StaffRoleName | 'student' | string;

export interface UserRow {
    id: number;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
    role_id: number;
    role_name: AnyRoleName;
    status: UserStatus;
    group_count: number;
    last_activity: number | null;
    created_at: number;
}

export interface UserListResponse {
    rows: UserRow[];
    total: number;
    page: number;
    page_size: number;
    next_cursor: string | null;
}

/**
 * Plan 03 detail-page shape — mirrors admin-api UserDetailDto exactly.
 *
 * Differs from UserRow in the additional region/profile fields, the groups list,
 * and the course-access + recent-payments aggregates.
 */
export interface UserDetail {
    id: number;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
    role_id: number;
    role_name: AnyRoleName;
    status: UserStatus;
    last_activity: number | null;
    created_at: number;
    updated_at: number | null;
    country_id: number | null;
    province_id: number | null;
    city_id: number | null;
    school_id: number | null;
    avatar: string | null;
    about: string | null;
    verified: boolean;
    groups: Array<{ id: number; name: string; supervisor_id: number | null }>;
    course_access: Array<{
        sale_id: number;
        webinar_id: number | null;
        webinar_name: string | null;
        manual_added: boolean;
        access_days: number | null;
        created_at: number;
        refund_at: number | null;
    }>;
    recent_payments: Array<{
        id: number;
        amount: string;
        total_amount: string | null;
        created_at: number;
        refund_at: number | null;
    }>;
}

export interface UserActivityRow {
    id: number;
    ts: number;
    actor_id: number | null;
    action: string;
    entity: string;
    entity_id: string | null;
    meta: unknown;
}

export interface UserActivityResponse {
    rows: UserActivityRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface ListUsersQuery {
    page?: number;
    page_size?: number;
    role_name?: string;
    status?: UserStatus;
    region_id?: number;
    q?: string;
    sort?: 'created_at' | 'full_name' | 'last_activity';
    order?: 'asc' | 'desc';
    cursor?: string;
}

/**
 * Mirrors admin-api `CreateUserDto` (POST /admin-api/v1/admin/users). At least one of
 * `email` / `mobile` is required; admin-api enforces this at the service boundary.
 * `password` is optional — when omitted, the user logs in via the SMS-code flow.
 */
export interface CreateUserPayload {
    full_name?: string;
    email?: string;
    mobile?: string;
    password?: string;
    role_name: 'admin' | 'curator' | 'teacher' | 'user';
    status?: UserStatus;
}

/**
 * Mirrors admin-api `UsersAnalyticsResponseDto` (GET /admin-api/v1/admin/users/analytics).
 * `bucket` is Unix seconds at bucket start; bucket size is reflected in `range.bucket`.
 */
export type AnalyticsRange = '7d' | '30d' | '90d' | '365d' | 'custom';
export type AnalyticsBucket = 'day' | 'week' | 'month';

export interface UsersAnalyticsQuery {
    range?: AnalyticsRange;
    from?: number;
    to?: number;
    bucket?: AnalyticsBucket;
}

export interface UsersAnalyticsResponse {
    totals: {
        total_users: number;
        new_users_in_range: number;
        active_users_30d: number;
    };
    by_status: { active: number; inactive: number; pending: number };
    by_role: Array<{ role_name: string; count: number }>;
    registrations: Array<{ bucket: number; count: number }>;
    range: { from: number; to: number; bucket: AnalyticsBucket };
    generated_at: number;
}

/**
 * Mirrors admin-api `UserQuizzesResponseDto` (GET /admin-api/v1/admin/users/:id/quizzes).
 */
export interface UserQuizzesResponse {
    access: Array<{
        sale_id: number;
        quiz_id: number | null;
        quiz_badge_id: number | null;
        quiz_name: string | null;
        kind: 'quiz' | 'quiz_badge';
        manual_added: boolean;
        access_days: number | null;
        created_at: number;
        refund_at: number | null;
    }>;
    results: Array<{
        id: number;
        quiz_id: number;
        quiz_name: string | null;
        status: 'waiting' | 'passed' | 'failed';
        user_grade: number | null;
        created_at: number;
    }>;
}
