import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { DryRunResult } from '@/hooks/use-dry-run-preview';
import type {
    CreateUserPayload,
    ListUsersQuery,
    UserActivityResponse,
    UserDetail,
    UserListResponse,
    UserQuizzesResponse,
    UsersAnalyticsQuery,
    UsersAnalyticsResponse,
} from './types';

/**
 * Typed wrappers around the admin-api users endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/v1/admin/users/*` — the browser
 * NEVER hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 * Auth + Bearer attachment happens in the proxy Route Handler.
 *
 * Plans 04/05/06/07 add: changeRole, bulkProvisionDryRun, bulkProvisionCommit,
 * importCsvDryRun, importCsvCommit, exportUsers.
 */

const BASE = '/api/proxy/v1/admin/users';

function buildQuery(q: ListUsersQuery | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function listUsers(q?: ListUsersQuery): Promise<UserListResponse> {
    const res = await fetchWithRefresh(`${BASE}${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listUsers failed: ${res.status}`);
    return res.json();
}

export async function getUser(id: number | string): Promise<UserDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getUser failed: ${res.status}`);
    const json = await res.json();
    // admin-api detail/mutation endpoints wrap in apiResponse({success,status,message,data});
    // list endpoint returns the raw shape per glucose-admin-api/CLAUDE.md.
    return (json?.data ?? json) as UserDetail;
}

export async function patchUserProfile(id: number | string, body: Record<string, unknown>): Promise<UserDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`patchUserProfile failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as UserDetail;
}

/**
 * Plan 03 — paginated activity feed (AdminAuditLog rows scoped to entity='user' AND
 * entity_id=<id>). Lazy-loaded by the Activity tab so the audit-log query only runs
 * when the user clicks that tab (D-10).
 */
export async function getUserActivity(id: number | string, page = 1, page_size = 50): Promise<UserActivityResponse> {
    const res = await fetchWithRefresh(
        `${BASE}/${encodeURIComponent(String(id))}/activity?page=${page}&page_size=${page_size}`,
    );
    if (!res.ok) throw new Error(`getUserActivity failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as UserActivityResponse;
}

/**
 * Plan 03 — replace/adjust user's group memberships. `add` and `remove` are independent
 * arrays of group_ids. Server enforces curator-scope on `add` (must be a group the curator
 * supervises) and rejects with 403 + `groups_out_of_scope:<ids>`.
 */
export async function patchUserMemberships(
    id: number | string,
    body: { add?: number[]; remove?: number[] },
): Promise<UserDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/memberships`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`patchUserMemberships failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as UserDetail;
}

/**
 * Plan 04 — admin-only role change. Body MUST carry both `role_id` and `role_name`;
 * admin-api validates they refer to the same `roles` row (T-03-31). When `role_name`
 * is `'admin'`, `confirmation` MUST equal `String(user_id)` — RoleChangeDialog enforces
 * this client-side via TypeTheCountConfirmation, but server-side gate is independent.
 *
 * On success, callers should invalidate `['admin.users.detail', String(id)]` AND
 * `['admin.users.list']` so the detail page + list page reflect the new role.
 */
export async function changeUserRole(
    id: number | string,
    body: {
        role_id: number;
        role_name: 'admin' | 'curator' | 'teacher' | 'student';
        reason?: string;
        confirmation?: string;
    },
): Promise<{ id: number; role_id: number; role_name: string }> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `changeUserRole failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as { id: number; role_id: number; role_name: string };
}

/**
 * Hardcoded role list for the RoleChangeDialog Select. role_id values vary per
 * environment seed; the admin-api validates the (id, name) pair against `roles`
 * regardless, so a wrong id surfaces as a 400 `role_mismatch` and the operator
 * can correct it via the manual role_id input. Phase 4+ may swap this to a
 * server-fed list (`GET /admin-api/v1/admin/roles`).
 */
export const ROLE_OPTIONS: Array<{ id: number; name: 'admin' | 'curator' | 'teacher' | 'student' }> = [
    { id: 1, name: 'admin' },
    { id: 2, name: 'curator' },
    { id: 3, name: 'teacher' },
    { id: 4, name: 'student' },
];

/**
 * Plan 05 — bulk-provision (USR-04 + USR-05). Single endpoint serves both dry-run
 * and commit modes; admin-api discriminates via `mode` in the body.
 *
 * Dry-run can also be driven directly through `useDryRunPreview({ endpoint, body })`
 * since admin-api echoes a `DryRunResult`-shaped payload — this wrapper is the
 * canonical path for the commit call (mutation hook), and is reusable for any caller
 * that wants a typed dry-run too.
 *
 * On success, callers should invalidate `['admin.users.list']` (any args) so the list
 * page reflects updated `group_count`/access state, and clear bulk selection.
 */
export interface BulkProvisionInput {
    mode: 'dry_run' | 'commit';
    user_ids: number[];
    webinar_ids: number[];
    access_days?: number;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}

export interface BulkProvisionResult extends DryRunResult {
    bulk_op_id: string;
    mode: 'dry_run' | 'commit';
}

export async function bulkProvisionUsers(input: BulkProvisionInput): Promise<BulkProvisionResult> {
    const res = await fetchWithRefresh(`${BASE}/bulk-provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `bulkProvisionUsers failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    // bulk-provision response is raw (not apiResponse-wrapped) but tolerate both shapes.
    return (json?.data ?? json) as BulkProvisionResult;
}

/**
 * Plan 06 — CSV import (USR-06). Single endpoint serves both dry-run + commit modes
 * (admin-api discriminates via `mode` in the body). Admin-only — curator/teacher
 * receive 403 from RolesGuard upstream.
 *
 * Predicate symmetry: the dry-run preview is faithful — commit re-runs the SAME
 * classification and applies the writes inside chunked $transaction. The
 * `bulk_op_id` returned by dry-run should be passed back on commit so the audit
 * trail links the preview attempt to the actual write.
 *
 * On commit success, callers should invalidate `['admin.users.list']` (any args)
 * so the list page reflects new rows.
 */
export interface ImportRowInput {
    row_id: string;
    full_name?: string;
    email?: string;
    mobile?: string;
    role_name?: 'admin' | 'curator' | 'teacher' | 'student';
    status?: 'active' | 'inactive' | 'pending';
}

export interface ImportInput {
    mode: 'dry_run' | 'commit';
    rows: ImportRowInput[];
    bulk_op_id?: string;
    confirmed_count?: number;
}

export interface ImportResultRowPayload {
    row_id: string;
    status: 'insert' | 'update' | 'skip' | 'error';
    reason: string | null;
    user_id: number | null;
}

export interface ImportResultPayload {
    bulk_op_id: string;
    mode: 'dry_run' | 'commit';
    affected: number;
    insert: number;
    update: number;
    skip: number;
    error: number;
    rows: ImportResultRowPayload[];
}

export async function importUsers(input: ImportInput): Promise<ImportResultPayload> {
    const res = await fetchWithRefresh(`${BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `importUsers failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as ImportResultPayload;
}

/**
 * Plan 07 — CSV/XLSX export (USR-07). Returns a Blob the caller turns into a browser
 * download via `URL.createObjectURL`. Filter shape mirrors `ListUsersQuery` minus
 * pagination — exports respect filters + RBAC scope, but never paginate (admin-api
 * caps at 50k rows server-side).
 *
 * Throttled at admin-api: 5 calls / 15 min / IP. Callers should surface 429 to the
 * operator (toast.error on caught Error) — there is no client-side retry.
 */
export interface ExportInput {
    format: 'csv' | 'xlsx';
    role_name?: string;
    status?: 'active' | 'inactive' | 'pending';
    region_id?: number;
    q?: string;
    sort?: 'created_at' | 'full_name' | 'last_activity';
    order?: 'asc' | 'desc';
}

/**
 * Admin-only single-user creation. Mirrors admin-api POST /admin-api/v1/admin/users.
 *
 * On success, callers should invalidate `['admin.users.list']` (any args) so the new
 * row appears, and may navigate to `/${locale}/users/${created.id}` for the detail
 * page. The admin-api response is wrapped in `apiResponse({data})`; we unwrap here.
 */
export async function createUser(payload: CreateUserPayload): Promise<UserDetail> {
    const res = await fetchWithRefresh(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `createUser failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as UserDetail;
}

export async function exportUsers(input: ExportInput): Promise<Blob> {
    const res = await fetchWithRefresh(`${BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `exportUsers failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.blob();
}

/**
 * GET /admin-api/v1/admin/users/analytics — KPI + registrations trend for the
 * users page. Curator/teacher see counts narrowed to their data scope.
 */
export async function fetchUsersAnalytics(q?: UsersAnalyticsQuery): Promise<UsersAnalyticsResponse> {
    const usp = new URLSearchParams();
    if (q?.range) usp.set('range', q.range);
    if (typeof q?.from === 'number') usp.set('from', String(q.from));
    if (typeof q?.to === 'number') usp.set('to', String(q.to));
    if (q?.bucket) usp.set('bucket', q.bucket);
    const qs = usp.toString();
    const res = await fetchWithRefresh(`${BASE}/analytics${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `fetchUsersAnalytics failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as UsersAnalyticsResponse;
}

/**
 * GET /admin-api/v1/admin/users/:id/quizzes — quiz access + result feed used by
 * the detail page's "Tests" tab (lazy-loaded on tab activation).
 */
export async function fetchUserQuizzes(id: number | string): Promise<UserQuizzesResponse> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/quizzes`);
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `fetchUserQuizzes failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as UserQuizzesResponse;
}

/**
 * POST /admin-api/v1/admin/users/:id/export — per-user audit report (CSV or
 * multi-sheet XLSX). admin-api throttles at 10 calls / 15 min / IP.
 */
export async function exportUserDetail(id: number | string, format: 'csv' | 'xlsx'): Promise<Blob> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `exportUserDetail failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.blob();
}
