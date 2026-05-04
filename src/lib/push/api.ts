'use client';
/**
 * Phase 8 — BFF wrappers for the push surface.
 *
 * Plan 01: stubs.
 * Plan 03: broadcastPush, sendTestPushToMe, listPushHistory implemented.
 * Plan 04: schedulePush, listScheduledPushes, cancelScheduledPush will be implemented.
 *
 * URL convention: /api/proxy/v1/admin/push/<path> — the BFF proxy at
 * /api/proxy/[...path]/route.ts strips '/api/proxy/' and prepends '/admin-api/'
 * before forwarding server-to-server with the access-token Bearer attached. The
 * browser NEVER sees the JWT.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    PushBroadcastInput,
    PushBroadcastResult,
    PushHistoryListResponse,
    PushScheduleInput,
    PushTestToMeInput,
    ScheduledPushDetail,
    ScheduledPushListResponse,
} from './types';

export interface ListPushHistoryQuery {
    page?: number;
    page_size?: number;
    user_id?: number;
    trigger_type?: string;
    success?: boolean;
    /** Unix */
    date_from?: number;
    date_to?: number;
    sort?: 'sent_at';
    order?: 'asc' | 'desc';
}

export interface ListScheduledPushesQuery {
    page?: number;
    page_size?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
    creator_id?: number;
    sort?: 'scheduled_at' | 'created_at';
    order?: 'asc' | 'desc';
}

// Plan 03 — broadcast.
export async function broadcastPush(input: PushBroadcastInput): Promise<PushBroadcastResult> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`broadcastPush: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as PushBroadcastResult;
}

// Plan 03 — test-to-me.
export async function sendTestPushToMe(input: PushTestToMeInput): Promise<{ success: boolean; error?: string }> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendTestPushToMe: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as { success: boolean; error?: string };
}

// Plan 03 — history list.
export async function listPushHistory(q: ListPushHistoryQuery): Promise<PushHistoryListResponse> {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/push/history${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`listPushHistory: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as PushHistoryListResponse;
}

// TODO Plan 04: implement.
export async function schedulePush(_input: PushScheduleInput): Promise<ScheduledPushDetail> {
    throw new Error('schedulePush: stub — Plan 04 not landed yet');
}
export async function listScheduledPushes(_q: ListScheduledPushesQuery): Promise<ScheduledPushListResponse> {
    throw new Error('listScheduledPushes: stub — Plan 04 not landed yet');
}
export async function cancelScheduledPush(_id: string): Promise<ScheduledPushDetail> {
    throw new Error('cancelScheduledPush: stub — Plan 04 not landed yet');
}
