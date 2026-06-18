import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BulkMembersBody,
    BulkMembersResult,
    CascadePreview,
    ChangeSupervisorBody,
    CreateGroupBody,
    GroupDetail,
    GroupListResponse,
    ListGroupsQuery,
    MemberListResponse,
    MemberProgressResponse,
    ResolveMembersResult,
    ResolveRowInput,
    UpdateGroupBody,
} from './types';

/**
 * Typed wrappers around the admin-api groups endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/v1/admin/groups/*` — the browser
 * NEVER hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 * Auth + Bearer attachment happens in the proxy Route Handler.
 *
 * NOTE: This wrapper file is the canonical client surface for Phase 4. Plans 02/03/04
 * implement the admin-api side; until those plans land, calling these wrappers will
 * 404 against admin-api — that is expected and intentional. The page components in
 * Plans 02/03 import these wrappers directly without redefining them.
 */

const BASE = '/api/proxy/v1/admin/groups';

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

export async function listGroups(query?: ListGroupsQuery): Promise<GroupListResponse> {
    const res = await fetchWithRefresh(`${BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listGroups failed: ${res.status}`);
    return res.json();
}

export async function getGroup(id: number | string): Promise<GroupDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getGroup failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as GroupDetail;
}

export async function createGroup(body: CreateGroupBody): Promise<GroupDetail> {
    const res = await fetchWithRefresh(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `createGroup failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as GroupDetail;
}

export async function updateGroup(id: number | string, body: UpdateGroupBody): Promise<GroupDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `updateGroup failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as GroupDetail;
}

export async function deleteGroup(id: number | string): Promise<void> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `deleteGroup failed: ${res.status}`;
        throw new Error(msg);
    }
}

export async function getCascadePreview(id: number | string): Promise<CascadePreview> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/cascade-preview`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error(`getCascadePreview failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as CascadePreview;
}

export async function changeSupervisor(
    id: number | string,
    body: ChangeSupervisorBody,
): Promise<GroupDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/supervisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `changeSupervisor failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    return (json?.data ?? json) as GroupDetail;
}

export async function listGroupMembers(
    id: number | string,
    page = 1,
    page_size = 50,
    q?: string,
): Promise<MemberListResponse> {
    const res = await fetchWithRefresh(
        `${BASE}/${encodeURIComponent(String(id))}/members${buildQuery({ page, page_size, q })}`,
    );
    if (!res.ok) throw new Error(`listGroupMembers failed: ${res.status}`);
    return res.json();
}

export async function getMemberProgress(
    id: number | string,
    user_ids: number[],
): Promise<MemberProgressResponse> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/members/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids }),
    });
    if (!res.ok) throw new Error(`getMemberProgress failed: ${res.status}`);
    return res.json();
}

export async function bulkAddMembers(
    id: number | string,
    body: BulkMembersBody,
): Promise<BulkMembersResult> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `bulkAddMembers failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.json();
}

export async function bulkRemoveMembers(
    id: number | string,
    body: BulkMembersBody,
): Promise<BulkMembersResult> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `bulkRemoveMembers failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.json();
}

/**
 * Resolve Excel-imported rows ({ name?, phone? }) into existing-student candidates
 * (GRP-07). Read-only matching — the actual add still goes through bulkAddMembers.
 */
export async function resolveMembers(
    id: number | string,
    rows: ResolveRowInput[],
): Promise<ResolveMembersResult> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/members/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `resolveMembers failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.json();
}
