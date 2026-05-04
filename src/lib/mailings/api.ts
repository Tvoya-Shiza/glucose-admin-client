'use client';
/**
 * Phase 8 Plan 01 — BFF wrappers for the mailings surface.
 * Function bodies are STUBS — Plan 05 fills them.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { MailingSendInput, MailingSendResult, MailingHistoryListResponse } from './types';

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

// TODO Plan 05: implement
export async function sendMailing(_input: MailingSendInput): Promise<MailingSendResult> {
    throw new Error('sendMailing: stub — Plan 05 not landed yet');
}
export async function listMailingHistory(_q: ListMailingHistoryQuery): Promise<MailingHistoryListResponse> {
    throw new Error('listMailingHistory: stub — Plan 05 not landed yet');
}

void fetchWithRefresh;
