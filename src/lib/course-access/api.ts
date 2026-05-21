import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CourseAccessorsListResponse,
    CourseAccessorsSummary,
    CreatedGrant,
    ExtendAccessBody,
    ExtendedGrant,
    GrantGroupAccessBody,
    GrantUserAccessBody,
    GroupGrantsListResponse,
    ListCourseAccessorsQuery,
    ListGroupGrantsQuery,
    RevokedGrant,
} from './types';

/**
 * Phase 18 — typed wrappers around the admin-api course-access endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/v1/admin/*` — the browser never
 * hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 *
 * Mutation responses are unwrapped from the apiResponse envelope (`{ data: ... }`)
 * to match the project's convention; list responses are returned raw.
 */

const PROXY = '/api/proxy/v1/admin';

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

// ---------------------------------------------------------------------------
// Feature A — group grants
// ---------------------------------------------------------------------------

export async function listGroupGrants(
    groupId: number | string,
    query?: ListGroupGrantsQuery,
): Promise<GroupGrantsListResponse> {
    const url = `${PROXY}/groups/${encodeURIComponent(String(groupId))}/course-access${buildQuery(query as Record<string, unknown> | undefined)}`;
    const res = await fetchWithRefresh(url);
    if (!res.ok) throw new Error(await extractError(res, 'listGroupGrants failed'));
    return (await res.json()) as GroupGrantsListResponse;
}

export async function grantGroupAccess(
    groupId: number | string,
    body: GrantGroupAccessBody,
): Promise<CreatedGrant> {
    const res = await fetchWithRefresh(`${PROXY}/groups/${encodeURIComponent(String(groupId))}/course-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'grantGroupAccess failed'));
    const json = await res.json();
    return (json?.data ?? json) as CreatedGrant;
}

// ---------------------------------------------------------------------------
// Feature C primary use (also used by Feature A "grant-direct" admin button)
// ---------------------------------------------------------------------------

export async function grantUserAccess(
    userId: number | string,
    body: GrantUserAccessBody,
): Promise<CreatedGrant> {
    const res = await fetchWithRefresh(`${PROXY}/users/${encodeURIComponent(String(userId))}/course-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'grantUserAccess failed'));
    const json = await res.json();
    return (json?.data ?? json) as CreatedGrant;
}

// ---------------------------------------------------------------------------
// Shared mutation on the sale row — works for both direct and group grants
// ---------------------------------------------------------------------------

export async function extendAccess(saleId: number, body: ExtendAccessBody): Promise<ExtendedGrant> {
    const res = await fetchWithRefresh(`${PROXY}/sales/${encodeURIComponent(String(saleId))}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await extractError(res, 'extendAccess failed'));
    const json = await res.json();
    return (json?.data ?? json) as ExtendedGrant;
}

export async function revokeAccess(saleId: number): Promise<RevokedGrant> {
    const res = await fetchWithRefresh(`${PROXY}/sales/${encodeURIComponent(String(saleId))}/access`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await extractError(res, 'revokeAccess failed'));
    const json = await res.json();
    return (json?.data ?? json) as RevokedGrant;
}

// ---------------------------------------------------------------------------
// Feature C — Course → Accessors tab
// ---------------------------------------------------------------------------

export async function listCourseAccessors(
    courseId: number | string,
    query?: ListCourseAccessorsQuery,
): Promise<CourseAccessorsListResponse> {
    const url = `${PROXY}/courses/${encodeURIComponent(String(courseId))}/accessors${buildQuery(query as Record<string, unknown> | undefined)}`;
    const res = await fetchWithRefresh(url);
    if (!res.ok) throw new Error(await extractError(res, 'listCourseAccessors failed'));
    return (await res.json()) as CourseAccessorsListResponse;
}

export async function getCourseAccessorsSummary(courseId: number | string): Promise<CourseAccessorsSummary> {
    const res = await fetchWithRefresh(
        `${PROXY}/courses/${encodeURIComponent(String(courseId))}/accessors/summary`,
    );
    if (!res.ok) throw new Error(await extractError(res, 'getCourseAccessorsSummary failed'));
    return (await res.json()) as CourseAccessorsSummary;
}
