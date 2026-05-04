'use client';
/**
 * Phase 7 Plan 01 — BFF wrappers for the promocodes surface.
 *
 * Function bodies are STUBS — every function throws a "Plan 05 not landed yet"
 * error. Plan 05 fills the bodies with fetchWithRefresh + endpoint URLs.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/promocodes/*`.
 *
 * Note (D-13): promocodes have NO bulk-status flow — the model differs from
 * Stories/Banners/Blogs (no shared BlogStatus enum). Plan 05 implements only
 * single-row toggle via the `is_active` field.
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
    sort?: 'created_at' | 'expires_at' | 'usage_count';
    order?: 'asc' | 'desc';
}

export interface ListPromocodeUsagesQuery {
    page?: number;
    page_size?: number;
    sort?: 'used_at';
    order?: 'asc' | 'desc';
}

// TODO Plan 05: implement
export async function listPromocodes(_q?: ListPromocodesQuery): Promise<PromocodeListResponse> {
    throw new Error('listPromocodes: stub — Plan 05 not landed yet');
}

// TODO Plan 05: implement
export async function getPromocode(_id: number): Promise<PromocodeDetail> {
    throw new Error('getPromocode: stub — Plan 05 not landed yet');
}

// TODO Plan 05: implement
export async function createPromocode(_input: PromocodeUpsertInput): Promise<PromocodeDetail> {
    throw new Error('createPromocode: stub — Plan 05 not landed yet');
}

// TODO Plan 05: implement
export async function updatePromocode(_id: number, _input: Partial<PromocodeUpsertInput>): Promise<PromocodeDetail> {
    throw new Error('updatePromocode: stub — Plan 05 not landed yet');
}

// TODO Plan 05: implement
export async function deletePromocode(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deletePromocode: stub — Plan 05 not landed yet');
}

// TODO Plan 05: implement (PRM-02 — usage list endpoint)
export async function listPromocodeUsages(
    _promocodeId: number,
    _q?: ListPromocodeUsagesQuery,
): Promise<PromocodeUsageListResponse> {
    throw new Error('listPromocodeUsages: stub — Plan 05 not landed yet');
}

void fetchWithRefresh;
