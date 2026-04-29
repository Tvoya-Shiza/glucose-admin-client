import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { ListUsersQuery, UserDetail, UserListResponse } from './types';

/**
 * Typed wrappers around the admin-api users endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/v1/admin/users/*` — the browser
 * NEVER hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 * Auth + Bearer attachment happens in the proxy Route Handler.
 *
 * Plans 04/05/06/07 add: changeRole, bulkProvisionDryRun, bulkProvisionCommit,
 * importCsvDryRun, importCsvCommit, exportUsers.
 */

const BASE = '/api/proxy/v1/admin/users';

function buildQuery(q: ListUsersQuery | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function listUsers(q?: ListUsersQuery): Promise<UserListResponse> {
    const res = await fetchWithRefresh(`${BASE}${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listUsers failed: ${res.status}`);
    return res.json();
}

export async function getUser(id: number | string): Promise<UserDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getUser failed: ${res.status}`);
    const json = await res.json();
    // admin-api detail/mutation endpoints wrap in apiResponse({success,status,message,data});
    // list endpoint returns the raw shape per glucose-admin-api/CLAUDE.md.
    return (json?.data ?? json) as UserDetail;
}

export async function patchUserProfile(id: number | string, body: Record<string, unknown>): Promise<UserDetail> {
    const res = await fetchWithRefresh(`${BASE}/${encodeURIComponent(String(id))}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`patchUserProfile failed: ${res.status}`);
    const json = await res.json();
    return (json?.data ?? json) as UserDetail;
}
