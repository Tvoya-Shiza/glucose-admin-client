import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    KaspiPaymentDetail,
    KaspiPaymentListResponse,
    PaymentExportInput,
    PaymentListQuery,
} from './types';

/**
 * BFF wrappers for Phase 9 PAY-01 / PAY-04.
 *
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/payments/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api
 * (admin-client CLAUDE.md: "Bypassing the BFF proxy" forbidden).
 *
 * Mirrors lib/users/api.ts shape verbatim (Phase 3 Plan 02 + Plan 07 reference).
 *
 * Plan 01 stubs replaced with real bodies in Plan 02.
 */

export const PAYMENTS_API_BASE = '/api/proxy/v1/admin/payments';

function buildQuery(q: PaymentListQuery | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

export async function listPayments(q?: PaymentListQuery): Promise<KaspiPaymentListResponse> {
    const res = await fetchWithRefresh(`${PAYMENTS_API_BASE}${buildQuery(q)}`);
    if (!res.ok) throw new Error(`listPayments failed: ${res.status}`);
    return res.json();
}

export async function getPayment(id: number | string): Promise<KaspiPaymentDetail> {
    const res = await fetchWithRefresh(`${PAYMENTS_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getPayment failed: ${res.status}`);
    const json = await res.json();
    // Detail endpoint returns the raw shape (NOT apiResponse-wrapped) per
    // payments-detail.controller.ts — but tolerate both shapes for forward compat.
    return (json?.data ?? json) as KaspiPaymentDetail;
}

/**
 * PAY-04 — CSV/XLSX export. Returns a Blob the caller turns into a browser
 * download via `URL.createObjectURL`. Filter shape mirrors `PaymentListQuery`
 * minus pagination — exports respect filters + admin-only RBAC scope, but
 * never paginate (admin-api caps at 50k rows server-side).
 *
 * Throttled at admin-api: 5 calls / 15 min / IP. Callers should surface 429 to
 * the operator (toast.error on caught Error) — there is no client-side retry.
 */
export async function exportPayments(input: PaymentExportInput): Promise<Blob> {
    const res = await fetchWithRefresh(`${PAYMENTS_API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        if (res.status === 429) {
            throw new Error('export_throttle');
        }
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `exportPayments failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.blob();
}
