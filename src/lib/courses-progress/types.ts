/**
 * Phase 19 / Feature B2 — client-side mirror of progress-report DTOs.
 * Lockstep with glucose-admin-api/src/modules/courses/dto/progress-report.dto.ts.
 */

export type ProgressUserStatusKind =
    | 'not_started'
    | 'viewed'
    | 'passed'
    | 'failed'
    | 'pending'
    | 'not_submitted';

export interface ProgressUserStatus {
    status: ProgressUserStatusKind;
    score: number | null;
    grade: number | null;
    last_at: number | null;
    attempts: number | null;
}

export interface ProgressGroupCompletion {
    done: number;
    total: number;
    ratio: number;
}

export interface ProgressItem {
    id: number;
    type: string;
    item_id: number;
    title: string;
    is_required: boolean;
    user_status: ProgressUserStatus | null;
    group_completion: ProgressGroupCompletion | null;
}

export interface ProgressChapter {
    id: number;
    title: string;
    items: ProgressItem[];
}

export interface ProgressAggregate {
    done: number;
    total: number;
    percent: number;
}

export interface ProgressTargetSummary {
    kind: 'user' | 'group';
    target_id: number;
    label: string | null;
    members_count: number | null;
}

export interface ProgressReport {
    target: ProgressTargetSummary;
    chapters: ProgressChapter[];
    aggregate: ProgressAggregate;
    last_activity: number | null;
}

export interface ProgressReportQuery {
    target_kind: 'user' | 'group';
    target_id: number;
}
