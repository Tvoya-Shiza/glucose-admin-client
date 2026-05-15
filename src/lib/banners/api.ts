'use client';
/**
 * Phase 7 Plan 03 — BFF wrappers for the banners (Advertisement) surface.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/banners/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api.
 *
 * Mirrors lib/stories/api.ts (Plan 02). The wire field for bulk status is
 * `banner_ids` (matches admin-api DTO).
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BannerDetail,
    BannerListResponse,
    BannerUpsertInput,
    BannerStatus,
    BulkStatusToggleResult,
} from './types';

export const BANNERS_API_BASE = '/api/proxy/v1/admin/banners';

export interface ListBannersQuery {
    page?: number;
    page_size?: number;
    q?: string;
    status?: BannerStatus;
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
// Banners CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listBanners(q?: ListBannersQuery): Promise<BannerListResponse> {
    const res = await fetchWithRefresh(`${BANNERS_API_BASE}${buildQuery(q as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listBanners failed: ${res.status}`);
    return res.json();
}

export async function getBanner(id: number): Promise<BannerDetail> {
    const res = await fetchWithRefresh(`${BANNERS_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `getBanner failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BannerDetail>(json);
}

export async function createBanner(input: BannerUpsertInput): Promise<BannerDetail> {
    const res = await fetchWithRefresh(BANNERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createBanner failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BannerDetail>(json);
}

export async function updateBanner(id: number, input: Partial<BannerUpsertInput>): Promise<BannerDetail> {
    const res = await fetchWithRefresh(`${BANNERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateBanner failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BannerDetail>(json);
}

export async function deleteBanner(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${BANNERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBanner failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function bulkUpdateBannerStatus(input: {
    mode: 'dry_run' | 'commit';
    banner_ids: number[];
    status: BannerStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    const res = await fetchWithRefresh(`${BANNERS_API_BASE}/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `bulkUpdateBannerStatus failed: ${res.status}`));
    return res.json();
}
