/**
 * Audit-read shared types — mirror of admin-api AuditRowDto + AuditListResponseDto.
 *
 * Plan 02 (global feed page) and Plan 03 (per-entity AuditLogTab) both consume
 * these. Locked contract — Plans 02 + 03 must NOT modify the shape.
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/audit/dto/audit-row.dto.ts.
 *
 * BigInt note (per glucose-admin-client/CLAUDE.md "BigInt-as-string"): the admin-api
 * audit-read service casts AdminAuditLog.id (BigInt) to Number at the boundary because
 * realistic id values stay well under 2^53. Same posture as Phase 3 user-activity.
 */

export interface AuditRow {
    id: number;
    ts: number; // Unix seconds
    actor_id: number | null;
    action: string;
    entity: string;
    entity_id: string | null;
    ip: string | null;
    ua: string | null;
    before: unknown | null;
    after: unknown | null;
    meta: Record<string, unknown> | null;
    bulk_op_id: string | null;
    request_id: string | null;
}

export interface AuditListResponse {
    rows: AuditRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface AuditFilters {
    page?: number;
    page_size?: number;
    actor_id?: number;
    action?: string;
    entity?: string;
    entity_id?: string;
    ts_from?: number; // Unix seconds inclusive
    ts_to?: number; // Unix seconds inclusive
}

export interface DistinctValues {
    values: string[];
}
