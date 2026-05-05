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
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/sales/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api
 * (admin-client CLAUDE.md: "Bypassing the BFF proxy" forbidden).
 *
 * Mirrors lib/payments/api.ts shape verbatim (Phase 9 Plan 02 reference impl).
 *
 * Plan 01 stubs replaced with real bodies in Plan 03.
 */

export const SALES_API_BASE = '/api/proxy/v1/admin/sales';

function buildQuery(q: SaleListQuery | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function listSales(q?: SaleListQuery): Promise<SaleListResponse> {
    const res = await fetchWithRefresh(`${SALES_API_BASE}${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listSales failed: ${res.status}`);
    return res.json();
}

export async function getSale(id: number | string): Promise<SaleDetail> {
    const res = await fetchWithRefresh(`${SALES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getSale failed: ${res.status}`);
    const json = await res.json();
    // Detail endpoint returns the raw shape (NOT apiResponse-wrapped) per
    // sales-detail.controller.ts — but tolerate both shapes for forward compat.
    return (json?.data ?? json) as SaleDetail;
}

/**
 * PAY-03 — refund the Sale (sets `Sale.refund_at = nowSec`). Server enforces
 * idempotency: a second refund call on the same Sale returns 409 Conflict.
 *
 * Caller MUST handle the `refund_already_refunded` Error variant separately
 * from generic failures (the refund dialog surfaces a localized
 * `admin.sales.refund_already_refunded` toast for 409).
 */
export async function refundSale(id: number | string, body: RefundInput): Promise<RefundResult> {
    const res = await fetchWithRefresh(`${SALES_API_BASE}/${encodeURIComponent(String(id))}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        if (res.status === 409) {
            throw new Error('refund_already_refunded');
        }
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `refundSale failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    // Mutation endpoint returns apiResponse-wrapped payload — unwrap `.data`.
    return (json?.data ?? json) as RefundResult;
}

/**
 * PAY-04 — CSV/XLSX export. Returns a Blob the caller turns into a browser
 * download via `URL.createObjectURL`. Filter shape mirrors `SaleListQuery`
 * minus pagination — exports respect filters + admin-only RBAC scope, but
 * never paginate (admin-api caps at 50k rows server-side).
 *
 * Throttled at admin-api: 5 calls / 15 min / IP. Callers should surface 429 to
 * the operator (toast.error on caught Error) — there is no client-side retry.
 */
export async function exportSales(input: SaleExportInput): Promise<Blob> {
    const res = await fetchWithRefresh(`${SALES_API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        if (res.status === 429) {
            throw new Error('export_throttle');
        }
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `exportSales failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.blob();
}
