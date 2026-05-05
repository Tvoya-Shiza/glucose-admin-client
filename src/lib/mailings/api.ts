'use client';
/**
 * Phase 8 — BFF wrappers for the mailings surface.
 *
 * Plan 01: stubs.
 * Plan 05: sendMailing, listMailingHistory implemented.
 *
 * URL convention: /api/proxy/v1/admin/mailings/<path> — the BFF proxy at
 * /api/proxy/[...path]/route.ts strips '/api/proxy/' and prepends '/admin-api/'
 * before forwarding server-to-server with the access-token Bearer attached. The
 * browser NEVER sees the JWT.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { MailingHistoryListResponse, MailingSendInput, MailingSendResult } from './types';

export interface ListMailingHistoryQuery {
    page?: number;
    page_size?: number;
    user_id?: number;
    subject?: string;
    success?: boolean;
    category?: 'marketing' | 'transactional' | 'reminder' | 'system';
    date_from?: number;
    date_to?: number;
    sort?: 'sent_at';
    order?: 'asc' | 'desc';
}

// Plan 05 — send.
export async function sendMailing(input: MailingSendInput): Promise<MailingSendResult> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/mailings/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`sendMailing: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as MailingSendResult;
}

// Plan 05 — history list.
export async function listMailingHistory(q: ListMailingHistoryQuery): Promise<MailingHistoryListResponse> {
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/mailings/history${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`listMailingHistory: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as MailingHistoryListResponse;
}
