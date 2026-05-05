import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    AdminKpiResponse,
    AnalyticsQuery,
    CuratorOverviewResponse,
    TeacherOverviewResponse,
} from './types';

/**
 * BFF wrappers for Phase 9 ANL-01..ANL-04 (Plan 05 — bodies wired).
 *
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/analytics/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api
 * (admin-client CLAUDE.md: "Bypassing the BFF proxy" forbidden).
 *
 * Mirrors lib/payments/api.ts shape verbatim.
 *
 * Plan 04 admin-api endpoints (verified against
 *   glucose-admin-api/src/modules/analytics/analytics.controller.ts):
 *   - GET /admin-api/v1/admin/analytics/admin-kpi        — admin only
 *   - GET /admin-api/v1/admin/analytics/curator-overview — admin + curator
 *   - GET /admin-api/v1/admin/analytics/teacher-overview — admin + teacher
 *
 * Each response is the raw JSON object (NOT apiResponse-wrapped) — Plan 04
 * services return the plain shape directly, mirroring list endpoints' raw-shape
 * convention (admin-api CLAUDE.md: "List endpoints return { rows, total,
 * pageCount } directly").
 */

export const ANALYTICS_API_BASE = '/api/proxy/v1/admin/analytics';

function buildQuery(q: AnalyticsQuery | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function getAdminKpi(q?: AnalyticsQuery): Promise<AdminKpiResponse> {
    const res = await fetchWithRefresh(`${ANALYTICS_API_BASE}/admin-kpi${buildQuery(q)}`);
    if (!res.ok) throw new Error(`getAdminKpi failed: ${res.status}`);
    return res.json();
}

export async function getCuratorOverview(q?: AnalyticsQuery): Promise<CuratorOverviewResponse> {
    const res = await fetchWithRefresh(`${ANALYTICS_API_BASE}/curator-overview${buildQuery(q)}`);
    if (!res.ok) throw new Error(`getCuratorOverview failed: ${res.status}`);
    return res.json();
}

export async function getTeacherOverview(q?: AnalyticsQuery): Promise<TeacherOverviewResponse> {
    const res = await fetchWithRefresh(`${ANALYTICS_API_BASE}/teacher-overview${buildQuery(q)}`);
    if (!res.ok) throw new Error(`getTeacherOverview failed: ${res.status}`);
    return res.json();
}
