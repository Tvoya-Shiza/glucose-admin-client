/**
 * TS types mirroring admin-api Groups DTO shapes (Phase 4 Plan 01).
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/groups/dto/*.dto.ts.
 *
 * BigInt note: Group.id and User.id in this Prisma schema are `Int` (not BigInt), so
 * `number` is safe everywhere here. If any column ever migrates to BigInt the relevant
 * field's type must switch to `string` in lockstep with the admin-api DTO change
 * (BigIntStringInterceptor in admin-api serializes BigInt as string).
 *
 * Schema gap note: Group has NO created_at column — `created_at` field is always null
 * in GroupRow until the schema gains the column. Documented in admin-api group-row.dto.ts.
 */

export type GroupStatus = 'active' | 'inactive';
export type MemberCountBucket = 'zero' | 'small' | 'medium' | 'large';
export type GroupSortField = 'created_at' | 'name' | 'member_count';
export type SortOrder = 'asc' | 'desc';

export interface SupervisorRef {
    id: number;
    full_name: string | null;
}

export interface CreatorRef {
    id: number;
    full_name: string | null;
}

export interface GroupRow {
    id: number;
    name: string;
    status: GroupStatus;
    supervisor: SupervisorRef | null;
    member_count: number;
    created_at: number | null;
}

export interface GroupListResponse {
    rows: GroupRow[];
    total: number;
    page: number;
    page_size: number;
    next_cursor: string | null;
}

export interface ListGroupsQuery {
    page?: number;
    page_size?: number;
    status?: GroupStatus;
    supervisor_id?: number;
    member_count_bucket?: MemberCountBucket;
    q?: string;
    sort?: GroupSortField;
    order?: SortOrder;
    cursor?: string;
}

export interface GroupDetail {
    id: number;
    name: string;
    status: GroupStatus;
    supervisor: SupervisorRef | null;
    creator: CreatorRef | null;
    member_count: number;
}

export interface MemberRow {
    user_id: number;
    full_name: string | null;
    email: string | null;
    role_name: string;
    status: 'active' | 'inactive' | 'pending';
    joined_at: number;
    last_activity: number | null;
}

export interface MemberListResponse {
    rows: MemberRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface MemberProgressRow {
    user_id: number;
    courses_started: number;
    courses_completed: number;
}

export interface MemberProgressResponse {
    rows: MemberProgressRow[];
}

export interface CascadePreview {
    affected_students: number;
    sample_student_names: string[];
    affected_schedules: number;
    affected_schedules_note: string | null;
}

export interface CreateGroupBody {
    name: string;
    status: GroupStatus;
    supervisor_id?: number | null;
}

export interface UpdateGroupBody {
    name?: string;
    status?: GroupStatus;
}

export interface ChangeSupervisorBody {
    supervisor_id: number; // 0 = clear assignment (mapped to null at admin-api service layer)
    reason?: string;
}

export type ActivityWindow = '1d' | '7d' | '30d' | 'all';

export interface BulkMembersBody {
    mode: 'dry_run' | 'commit';
    user_ids: number[];
    confirmed_count?: number;
    bulk_op_id?: string;
    reason?: string;
}

export interface BulkMembersResultRow {
    row_id: string;
    status: 'insert' | 'skip' | 'error' | 'remove';
    reason: string | null;
    user_id: number;
}

export interface BulkMembersResult {
    bulk_op_id: string;
    mode: 'dry_run' | 'commit';
    affected: number;
    insert: number;
    remove: number;
    skip: number;
    error: number;
    rows: BulkMembersResultRow[];
}

// --- Excel bulk-import resolution (GRP-07) ---
// Mirrors admin-api dto/resolve-members.dto.ts.

export interface ResolveRowInput {
    name?: string;
    phone?: string;
}

export interface StudentCandidate {
    user_id: number;
    full_name: string | null;
    mobile: string | null;
    email: string | null;
    status: 'active' | 'inactive' | 'pending';
    /** Whether the student is already a member of the target group. */
    in_this_group: boolean;
    /** Every group the student currently belongs to. */
    groups: Array<{ id: number; name: string }>;
}

export type ResolveRowStatus = 'matched' | 'ambiguous' | 'unmatched' | 'invalid';

export interface ResolveResultRow {
    /** 0-based index of the data row in the uploaded sheet. */
    index: number;
    input: { name: string | null; phone: string | null };
    status: ResolveRowStatus;
    /** Set only when status='matched'. */
    matched_user_id: number | null;
    /** True when matched by phone but the supplied name disagrees. */
    name_mismatch: boolean;
    /** True when this row resolves to a user already matched by an earlier row. */
    duplicate_in_file: boolean;
    /** One for 'matched', many for 'ambiguous', empty otherwise. */
    candidates: StudentCandidate[];
}

export interface ResolveMembersResult {
    rows: ResolveResultRow[];
}
