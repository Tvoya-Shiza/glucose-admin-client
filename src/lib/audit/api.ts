import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { AuditFilters, AuditListResponse, DistinctValues } from './types';

/**
 * Typed wrappers around the admin-api audit-read endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/admin-api/v1/admin/audit/*` — the
 * browser NEVER hits admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 * Auth + Bearer attachment happens in the proxy Route Handler.
 *
 * Server enforces RBAC narrowing via AUDIT_READ_SCOPE_RULES — these wrappers do NOT
 * filter by actor on the client side. Curator/teacher receive only their own actor's
 * rows regardless of any actor_id sent in the filter (admin-api spreads scope LAST).
 *
 * Plan 02 (global page) consumes all three; Plan 03 (AuditLogTab per-entity) consumes
 * only listAudit with `entity` + `entity_id` set.
 */

const BASE = '/api/proxy/admin-api/v1/admin/audit';

function toQueryString(filters: AuditFilters): string {
    const params = new URLSearchParams();
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.page_size !== undefined) params.set('page_size', String(filters.page_size));
    if (filters.actor_id !== undefined) params.set('actor_id', String(filters.actor_id));
    if (filters.action) params.set('action', filters.action);
    if (filters.entity) params.set('entity', filters.entity);
    if (filters.entity_id) params.set('entity_id', filters.entity_id);
    if (filters.ts_from !== undefined) params.set('ts_from', String(filters.ts_from));
    if (filters.ts_to !== undefined) params.set('ts_to', String(filters.ts_to));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export async function listAudit(filters: AuditFilters = {}): Promise<AuditListResponse> {
    const res = await fetchWithRefresh(`${BASE}/log${toQueryString(filters)}`);
    if (!res.ok) throw new Error(`listAudit failed: ${res.status}`);
    return (await res.json()) as AuditListResponse;
}

export async function listAuditActions(): Promise<DistinctValues> {
    const res = await fetchWithRefresh(`${BASE}/actions`);
    if (!res.ok) throw new Error(`listAuditActions failed: ${res.status}`);
    return (await res.json()) as DistinctValues;
}

export async function listAuditEntities(): Promise<DistinctValues> {
    const res = await fetchWithRefresh(`${BASE}/entities`);
    if (!res.ok) throw new Error(`listAuditEntities failed: ${res.status}`);
    return (await res.json()) as DistinctValues;
}
