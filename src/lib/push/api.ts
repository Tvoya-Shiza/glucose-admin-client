'use client';
/**
 * Phase 8 Plan 01 — BFF wrappers for the push surface.
 * Function bodies are STUBS — Plans 03-04 fill them with fetchWithRefresh.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    PushBroadcastInput,
    PushBroadcastResult,
    PushScheduleInput,
    PushTestToMeInput,
    PushHistoryListResponse,
    ScheduledPushListResponse,
    ScheduledPushDetail,
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

// TODO Plan 03: implement
export async function broadcastPush(_input: PushBroadcastInput): Promise<PushBroadcastResult> {
    throw new Error('broadcastPush: stub — Plan 03 not landed yet');
}
export async function sendTestPushToMe(_input: PushTestToMeInput): Promise<{ success: boolean; error?: string }> {
    throw new Error('sendTestPushToMe: stub — Plan 03 not landed yet');
}
export async function listPushHistory(_q: ListPushHistoryQuery): Promise<PushHistoryListResponse> {
    throw new Error('listPushHistory: stub — Plan 03 not landed yet');
}

// TODO Plan 04: implement
export async function schedulePush(_input: PushScheduleInput): Promise<ScheduledPushDetail> {
    throw new Error('schedulePush: stub — Plan 04 not landed yet');
}
export async function listScheduledPushes(_q: ListScheduledPushesQuery): Promise<ScheduledPushListResponse> {
    throw new Error('listScheduledPushes: stub — Plan 04 not landed yet');
}
export async function cancelScheduledPush(_id: string): Promise<ScheduledPushDetail> {
    throw new Error('cancelScheduledPush: stub — Plan 04 not landed yet');
}

void fetchWithRefresh;
