'use client';
/**
 * Phase 7 Plan 05 — BFF wrappers for the promocodes surface.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/promocodes/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api.
 *
 * Note (D-13/D-14): promocodes have NO bulk-status flow — the model differs from
 * Stories/Banners/Blogs (no shared BlogStatus enum). Single-row toggle via the
 * `is_active` field on PATCH.
 *
 * Decimal fields (`discount_value`, `max_discount_amount`, `minimum_order_amount`,
 * `discount_amount`, `order_amount`) are opaque strings — never call `Number()`.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    PromocodeDetail,
    PromocodeListResponse,
    PromocodeUpsertInput,
    DiscountType,
    PromocodeUsageListResponse,
} from './types';

export const PROMOCODES_API_BASE = '/api/proxy/v1/admin/promocodes';

export interface ListPromocodesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    discount_type?: DiscountType;
    is_active?: boolean;
    status_window?: 'active' | 'expired' | 'future' | 'all';
    sort?: 'created_at' | 'expires_at' | 'usage_count';
    order?: 'asc' | 'desc';
}

export interface ListPromocodeUsagesQuery {
    page?: number;
    page_size?: number;
    sort?: 'used_at';
    order?: 'asc' | 'desc';
}

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

function unwrapData<T>(json: unknown): T {
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
        return (json as { data: T }).data;
    }
    return json as T;
}

/**
 * Reads `{ status, message }` from an admin-api error response. Returns
 * `{ message, status }` so callers can map a `status === 'code_already_exists'`
 * payload to the localized toast (T-07-05-02 mitigation).
 */
async function readErrorPayload(res: Response, fallback: string): Promise<{ message: string; status: string | null }> {
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    const message = (json as { message?: string })?.message ?? fallback;
    const status = (json as { status?: string })?.status ?? null;
    return { message, status };
}

/**
 * Custom error type so the dialog's onError handler can branch on
 * `code_already_exists` (the apiResponse status from the 409) without parsing
 * raw strings. The 409 body shape from Nest is the unhandled `ConflictException`
 * default — `{ statusCode: 409, message: 'code_already_exists', error: 'Conflict' }`.
 * Detail: ConflictException.message becomes the `message` field. We mirror it
 * onto `.code` so callers can match.
 */
export class PromocodeApiError extends Error {
    public readonly httpStatus: number;
    public readonly code: string | null;
    constructor(message: string, httpStatus: number, code: string | null) {
        super(message);
        this.name = 'PromocodeApiError';
        this.httpStatus = httpStatus;
        this.code = code;
    }
}

async function readNestErrorMessage(
    res: Response,
    fallback: string,
): Promise<{ message: string; code: string | null }> {
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    // Nest ConflictException default body: { statusCode, message, error }
    // apiResponse-wrapped error: { success, status, message }
    const message =
        typeof json.message === 'string'
            ? json.message
            : Array.isArray(json.message)
              ? (json.message as unknown[]).join(', ')
              : fallback;
    const code =
        typeof (json as { status?: unknown }).status === 'string'
            ? ((json as { status: string }).status)
            : typeof json.message === 'string'
              ? (json.message as string)
              : null;
    return { message, code };
}

// ──────────────────────────────────────────────────────────────────────────────
// Promocodes CRUD (PRM-01)
// ──────────────────────────────────────────────────────────────────────────────

export async function listPromocodes(query?: ListPromocodesQuery): Promise<PromocodeListResponse> {
    const res = await fetchWithRefresh(
        `${PROMOCODES_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`,
    );
    if (!res.ok) {
        const { message } = await readErrorPayload(res, `listPromocodes failed: ${res.status}`);
        throw new Error(message);
    }
    return res.json();
}

export async function getPromocode(id: number): Promise<PromocodeDetail> {
    const res = await fetchWithRefresh(`${PROMOCODES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) {
        const { message } = await readErrorPayload(res, `getPromocode failed: ${res.status}`);
        throw new Error(message);
    }
    const json = await res.json();
    return unwrapData<PromocodeDetail>(json);
}

export async function createPromocode(input: PromocodeUpsertInput): Promise<PromocodeDetail> {
    const res = await fetchWithRefresh(PROMOCODES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const { message, code } = await readNestErrorMessage(res, `createPromocode failed: ${res.status}`);
        throw new PromocodeApiError(message, res.status, code);
    }
    const json = await res.json();
    return unwrapData<PromocodeDetail>(json);
}

export async function updatePromocode(
    id: number,
    input: Partial<PromocodeUpsertInput>,
): Promise<PromocodeDetail> {
    const res = await fetchWithRefresh(`${PROMOCODES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const { message, code } = await readNestErrorMessage(res, `updatePromocode failed: ${res.status}`);
        throw new PromocodeApiError(message, res.status, code);
    }
    const json = await res.json();
    return unwrapData<PromocodeDetail>(json);
}

export async function deletePromocode(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${PROMOCODES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) {
        const { message } = await readErrorPayload(res, `deletePromocode failed: ${res.status}`);
        throw new Error(message);
    }
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Promocode usages (PRM-02)
// ──────────────────────────────────────────────────────────────────────────────

export async function listPromocodeUsages(
    promocodeId: number,
    query?: ListPromocodeUsagesQuery,
): Promise<PromocodeUsageListResponse> {
    const res = await fetchWithRefresh(
        `${PROMOCODES_API_BASE}/${encodeURIComponent(String(promocodeId))}/usages${buildQuery(
            query as Record<string, unknown> | undefined,
        )}`,
    );
    if (!res.ok) {
        const { message } = await readErrorPayload(res, `listPromocodeUsages failed: ${res.status}`);
        throw new Error(message);
    }
    return res.json();
}
