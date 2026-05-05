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
 * Stub bodies — Plan 02 lands the actual implementations behind these
 * signatures. Throwing on call (rather than no-op) is intentional: it forces
 * Plans 02-05 to wire real bodies before any UI page can ship, and prevents an
 * accidental empty-state regression where a list page renders zero rows
 * because the api function silently resolves with `null`.
 *
 * All endpoints route through the BFF proxy `/api/proxy/v1/admin/payments/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api
 * (admin-client CLAUDE.md: "Bypassing the BFF proxy" forbidden).
 */

export const PAYMENTS_API_BASE = '/api/proxy/v1/admin/payments';

// Retain import so Plan 02 body migration does not have to reintroduce it.
void fetchWithRefresh;

export async function listPayments(_q?: PaymentListQuery): Promise<KaspiPaymentListResponse> {
    throw new Error('listPayments: stub — Plan 02 not landed yet');
}

export async function getPayment(_id: number | string): Promise<KaspiPaymentDetail> {
    throw new Error('getPayment: stub — Plan 02 not landed yet');
}

export async function exportPayments(_input: PaymentExportInput): Promise<Blob> {
    throw new Error('exportPayments: stub — Plan 02 not landed yet');
}
