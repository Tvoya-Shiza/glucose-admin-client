/**
 * Phase 19 — client-side mirror of glucose-admin-api progress-overrides DTOs.
 *
 * Keep in lockstep with:
 *   glucose-admin-api/src/modules/progress-overrides/dto/*.ts
 */

export interface OverrideTarget {
    kind: 'user' | 'group';
    target_id: number;
}

export interface OverrideGrantedByRef {
    id: number;
    full_name: string | null;
}

export interface OverrideRow {
    id: number;
    item_id: number;
    /** WebinarChapterItem.type: 'file' | 'quiz' | 'assignment'. String-typed to
     *  survive new enum values without breaking the client until the type
     *  literal is updated. */
    item_type: string;
    chapter_id: number;
    note: string | null;
    granted_at: number;
    expires_at: number | null;
    granted_by: OverrideGrantedByRef | null;
}

export interface OverrideListResponse {
    rows: OverrideRow[];
    total: number;
}

export interface ListOverridesQuery {
    target_kind: 'user' | 'group';
    target_id: number;
}

export interface BulkGrantOverridesBody {
    target: OverrideTarget;
    item_ids: number[];
    /** Unix sec; null/omitted = perpetual. */
    expires_at?: number | null;
    note?: string;
}

export interface BulkRevokeOverridesBody {
    target: OverrideTarget;
    item_ids: number[];
}

export interface BulkGrantResult {
    created: number;
    skipped: number;
    created_item_ids: number[];
}

export interface BulkRevokeResult {
    deleted: number;
}
