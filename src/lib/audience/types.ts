/**
 * Phase 8 Plan 01 — shared audience filter types.
 *
 * Used by AudienceSelector (Plan 02), push compose (Plan 03), push schedule
 * (Plan 04), and mailings compose (Plan 05). The discriminated-union shape
 * maps directly to the JSON stored in ScheduledPush.audience and to the
 * audit-log meta payload (D-17 audience_hash is sha256 of canonical JSON).
 *
 * IMPORTANT: AudienceFilter is the WIRE SHAPE. Server resolves it to a
 * concrete user_id list at fire-time (broadcast) or schedule-fire-time
 * (cron). Client never sees user_ids except in the audience-preview sample.
 */
export type AudienceKind = 'group' | 'role' | 'region' | 'cohort';

// Free-form: matched against the real `User.role_name` column (app users are 'user').
// The role picker is data-driven from GET /push/roles, not a fixed enum.
export type AudienceRole = string;

/** One row of GET /push/roles — a real role_name and how many users have it. */
export interface AudienceRoleCount {
    role_name: string;
    count: number;
}

export type RegionField = 'country_id' | 'province_id' | 'city_id' | 'district_id' | 'school_id';

export interface GroupAudienceFilter {
    kind: 'group';
    group_ids: number[];
}

export interface RoleAudienceFilter {
    kind: 'role';
    roles: AudienceRole[];
}

export interface RegionAudienceFilter {
    kind: 'region';
    /** Which User.*_id column to filter on. Default: 'province_id'. */
    field: RegionField;
    region_ids: number[];
}

export type CohortPredicate =
    | { type: 'completed_course'; webinar_id: number }
    | { type: 'inactive_days'; days: number }
    | { type: 'status'; status: 'active' | 'pending' | 'inactive' };

export interface CohortAudienceFilter {
    kind: 'cohort';
    predicate: CohortPredicate;
}

export type AudienceFilter = GroupAudienceFilter | RoleAudienceFilter | RegionAudienceFilter | CohortAudienceFilter;

export interface AudienceShape {
    /**
     * Filters are AND-combined when more than one is present, then optionally
     * intersected with the exclude flags below. v1 keeps the AND semantics
     * simple; OR-combinations are deferred (DEFERRED IDEAS in CONTEXT).
     */
    filters: AudienceFilter[];
    /** push-only — drops users without an active fcm_token */
    exclude_no_fcm?: boolean;
    /** mailings-only — drops users without User.email */
    exclude_no_email?: boolean;
    /** future-proofing; v1 = false (we have no unsubscribe table yet) */
    exclude_unsubscribed?: boolean;
}

export interface AudiencePreview {
    count: number;
    /** How many of `count` have an active FCM token (will actually receive a push). */
    count_with_fcm: number;
    sample: Array<{ id: number; full_name: string | null; email: string | null }>;
    /** sha256 of canonical JSON; reused as audit meta key (D-17). */
    audience_hash: string;
    /** true when served from 30s cache (D-18). */
    cached: boolean;
}
