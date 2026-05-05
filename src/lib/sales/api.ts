import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    RefundInput,
    RefundResult,
    SaleDetail,
    SaleExportInput,
    SaleListQuery,
    SaleListResponse,
} from './types';

/**
 * BFF wrappers for Phase 9 PAY-02 / PAY-03 / PAY-04.
 *
 * Stub bodies — Plan 03 lands the actual implementations behind these
 * signatures. Throwing on call (rather than no-op) is intentional: it forces
 * Plans 02-05 to wire real bodies before any UI page can ship, and prevents an
 * accidental empty-state regression where a list page renders zero rows
 * because the api function silently resolves with `null`.
 *
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/sales/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api
 * (admin-client CLAUDE.md: "Bypassing the BFF proxy" forbidden).
 */

export const SALES_API_BASE = '/api/proxy/v1/admin/sales';

// Retain import so Plan 03 body migration does not have to reintroduce it.
void fetchWithRefresh;

export async function listSales(_q?: SaleListQuery): Promise<SaleListResponse> {
    throw new Error('listSales: stub — Plan 03 not landed yet');
}

export async function getSale(_id: number | string): Promise<SaleDetail> {
    throw new Error('getSale: stub — Plan 03 not landed yet');
}

export async function refundSale(_id: number | string, _body: RefundInput): Promise<RefundResult> {
    throw new Error('refundSale: stub — Plan 03 not landed yet');
}

export async function exportSales(_input: SaleExportInput): Promise<Blob> {
    throw new Error('exportSales: stub — Plan 03 not landed yet');
}
