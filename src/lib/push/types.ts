/**
 * Phase 8 Plan 01 — shared push types.
 *
 * Schema reference (glucose-admin-api/prisma/schema.prisma):
 *   - PushNotificationLog (existing): id BigInt, user_id Int, trigger_type VarChar(100),
 *     sent_at Timestamp, success Bool, meta Json. Plan 03 writes 'admin.broadcast' |
 *     'admin.scheduled' | 'admin.test' to trigger_type. meta carries
 *     {attempt_id, broadcast_id?, scheduled_push_id?, category, audience_hash, error?}.
 *   - ScheduledPush (Plan 01 new): id BigInt, status enum, scheduled_at Unix, etc.
 *
 * BigInt convention: admin-api serializes BigInt as string. Treat IDs as opaque strings.
 */
import type { AudienceShape } from '../audience/types';

export type NotificationCategory = 'info' | 'promo' | 'reminder' | 'system';

export interface PushPayload {
    title_kz: string;
    body_kz: string;
    category: NotificationCategory;
    deep_link?: string | null;
}

export interface PushBroadcastInput {
    payload: PushPayload;
    audience: AudienceShape;
    /**
     * When set: server uses this as the broadcast_id seed for attempt_id derivation.
     * When omitted: server generates a v4 UUID. Pass when retrying a broadcast (rare).
     */
    broadcast_id?: string;
}

export interface PushBroadcastResult {
    broadcast_id: string;
    audience_count: number;
    delivered_count: number;
    failed_count: number;
    /** rows where attempt_id already existed */
    duplicate_dedup_count: number;
    started_at: number;
    completed_at: number;
}

export interface PushScheduleInput {
    payload: PushPayload;
    audience: AudienceShape;
    /** Unix UTC */
    scheduled_at: number;
}

export interface PushTestToMeInput {
    payload: PushPayload;
}

export interface ScheduledPushRow {
    /** BigInt-as-string */
    id: string;
    title_kz: string;
    category: NotificationCategory;
    scheduled_at: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
    audience_count: number;
    delivered_count: number;
    failed_count: number;
    creator_id: number;
    creator_full_name: string | null;
    created_at: number;
    cancelled_at: number | null;
    error: string | null;
}

export interface ScheduledPushDetail extends ScheduledPushRow {
    body_kz: string;
    deep_link: string | null;
    audience: AudienceShape;
    started_at: number | null;
    completed_at: number | null;
}

export interface ScheduledPushListResponse {
    rows: ScheduledPushRow[];
    total: number;
    pageCount: number;
}

export interface PushHistoryRow {
    /** BigInt-as-string */
    id: string;
    user_id: number;
    user_full_name: string | null;
    user_email: string | null;
    /** 'admin.broadcast' | 'admin.scheduled' | 'admin.test' | 'auto.inactivity' | ... */
    trigger_type: string;
    /** Unix (server converts Timestamp → seconds) */
    sent_at: number;
    success: boolean;
    meta: {
        attempt_id?: string;
        broadcast_id?: string;
        scheduled_push_id?: string;
        category?: NotificationCategory;
        audience_hash?: string;
        error?: string;
    } | null;
}

export interface PushHistoryListResponse {
    rows: PushHistoryRow[];
    total: number;
    pageCount: number;
}
