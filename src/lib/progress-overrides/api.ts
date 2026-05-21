import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BulkGrantOverridesBody,
    BulkGrantResult,
    BulkRevokeOverridesBody,
    BulkRevokeResult,
    ListOverridesQuery,
    OverrideListResponse,
} from './types';

/**
 * Phase 19 — typed wrappers around the admin-api progress-overrides endpoints.
 * BFF proxy contract: all calls go through `/api/proxy/v1/admin/courses/:id/overrides`.
 */

const PROXY = '/api/proxy/v1/admin/courses';

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

async function extractError(res: Response, fallback: string): Promise<string> {
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    return (json as { message?: string })?.message ?? `${fallback}: ${res.status}`;
}

export async function listOverrides(
    courseId: number | string,
    query: ListOverridesQuery,
): Promise<OverrideListResponse> {
    const url = `${PROXY}/${encodeURIComponent(String(courseId))}/overrides${buildQuery(query as unknown as Record<string, unknown>)}`;
    const res = await fetchWithRefresh(url);
    if (!res.ok) throw new Error(await extractError(res, 'listOverrides failed'));
    return (await res.json()) as OverrideListResponse;
}

export async function bulkGrantOverrides(
    courseId: number | string,
    body: BulkGrantOverridesBody,
): Promise<BulkGrantResult> {
    const res = await fetchWithRefresh(`${PROXY}/${encodeURIComponent(String(courseId))}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'bulkGrantOverrides failed'));
    const json = await res.json();
    return (json?.data ?? json) as BulkGrantResult;
}

export async function bulkRevokeOverrides(
    courseId: number | string,
    body: BulkRevokeOverridesBody,
): Promise<BulkRevokeResult> {
    const res = await fetchWithRefresh(`${PROXY}/${encodeURIComponent(String(courseId))}/overrides`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'bulkRevokeOverrides failed'));
    const json = await res.json();
    return (json?.data ?? json) as BulkRevokeResult;
}
