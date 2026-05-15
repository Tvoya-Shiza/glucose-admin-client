'use client';
/**
 * Phase 7 Plan 02 — BFF wrappers for the stories surface.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/stories/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    StoryDetail,
    StoryListResponse,
    StoryUpsertInput,
    StoryStatus,
    BulkStatusToggleResult,
} from './types';

export const STORIES_API_BASE = '/api/proxy/v1/admin/stories';

export interface ListStoriesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    status?: StoryStatus;
    sort?: 'created_at' | 'updated_at' | 'visit_count';
    order?: 'asc' | 'desc';
}

function buildQuery(query: Record<string, unknown> | undefined): string {
    if (!query) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

function unwrapData<T>(json: unknown): T {
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
        return (json as { data: T }).data;
    }
    return json as T;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    return (json as { message?: string })?.message ?? fallback;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stories CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listStories(q?: ListStoriesQuery): Promise<StoryListResponse> {
    const res = await fetchWithRefresh(`${STORIES_API_BASE}${buildQuery(q as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listStories failed: ${res.status}`);
    return res.json();
}

export async function getStory(id: number): Promise<StoryDetail> {
    const res = await fetchWithRefresh(`${STORIES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `getStory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<StoryDetail>(json);
}

export async function createStory(input: StoryUpsertInput): Promise<StoryDetail> {
    const res = await fetchWithRefresh(STORIES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createStory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<StoryDetail>(json);
}

export async function updateStory(id: number, input: Partial<StoryUpsertInput>): Promise<StoryDetail> {
    const res = await fetchWithRefresh(`${STORIES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateStory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<StoryDetail>(json);
}

export async function deleteStory(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${STORIES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteStory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function bulkUpdateStoryStatus(input: {
    mode: 'dry_run' | 'commit';
    story_ids: number[];
    status: StoryStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    const res = await fetchWithRefresh(`${STORIES_API_BASE}/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `bulkUpdateStoryStatus failed: ${res.status}`));
    return res.json();
}
