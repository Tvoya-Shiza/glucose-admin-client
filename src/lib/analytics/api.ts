import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    AdminKpiResponse,
    AnalyticsQuery,
    CuratorOverviewResponse,
    TeacherOverviewResponse,
} from './types';

/**
 * BFF wrappers for Phase 9 ANL-01..ANL-04.
 *
 * Stub bodies — Plan 04 lands the actual implementations behind these
 * signatures. Throwing on call (rather than no-op) is intentional: it forces
 * Plans 04 + 05 (the dashboard UI surface) to wire real bodies before the
 * dashboard pages can ship, and prevents an accidental empty-state regression
 * where a chart renders zero data because the api function silently resolves
 * with `null`.
 *
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/analytics/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api.
 */

export const ANALYTICS_API_BASE = '/api/proxy/v1/admin/analytics';

// Retain import so Plan 04 body migration does not have to reintroduce it.
void fetchWithRefresh;

export async function getAdminKpi(_q?: AnalyticsQuery): Promise<AdminKpiResponse> {
    throw new Error('getAdminKpi: stub — Plan 04 not landed yet');
}

export async function getCuratorOverview(_q?: AnalyticsQuery): Promise<CuratorOverviewResponse> {
    throw new Error('getCuratorOverview: stub — Plan 04 not landed yet');
}

export async function getTeacherOverview(_q?: AnalyticsQuery): Promise<TeacherOverviewResponse> {
    throw new Error('getTeacherOverview: stub — Plan 04 not landed yet');
}
