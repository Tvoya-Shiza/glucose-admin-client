/**
 * Phase 8 Plan 01 — shared mailings types.
 *
 * Schema reference: MailingLog (Plan 01 new) — id BigInt, user_id, sender_id?,
 * subject, to_email, category VarChar(32), sent_at Timestamp, success Bool, meta Json.
 */
import type { AudienceShape } from '../audience/types';

export type MailingCategory = 'marketing' | 'transactional' | 'reminder' | 'system';

export interface MailingSendInput {
    subject: string;
    /** HTML body. Server is responsible for sanitization before SMTP transport. */
    html: string;
    text?: string;
    category: MailingCategory;
    audience: AudienceShape;
    /** Optional broadcast_id seed for attempt_id derivation. */
    broadcast_id?: string;
}

export interface MailingSendResult {
    broadcast_id: string;
    audience_count: number;
    delivered_count: number;
    failed_count: number;
    duplicate_dedup_count: number;
    started_at: number;
    completed_at: number;
    /** true when SMTP_HOST is blank — no rows written */
    smtp_unconfigured?: boolean;
}

export interface MailingHistoryRow {
    /** BigInt-as-string */
    id: string;
    user_id: number;
    user_full_name: string | null;
    sender_id: number | null;
    sender_full_name: string | null;
    subject: string;
    to_email: string;
    category: MailingCategory;
    sent_at: number;
    success: boolean;
    error: string | null;
    meta: {
        attempt_id?: string;
        broadcast_id?: string;
        audience_hash?: string;
        smtp_message_id?: string;
    } | null;
}

export interface MailingHistoryListResponse {
    rows: MailingHistoryRow[];
    total: number;
    pageCount: number;
}
