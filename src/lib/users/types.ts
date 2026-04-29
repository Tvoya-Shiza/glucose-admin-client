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

/** Plan 03 detail-page shape (placeholder; Plan 03 may extend with more relations). */
export interface UserDetail extends UserRow {
    groups: Array<{ id: number; name: string }>;
    recent_purchases: Array<{ webinar_id: number; webinar_name: string; created_at: number }>;
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
