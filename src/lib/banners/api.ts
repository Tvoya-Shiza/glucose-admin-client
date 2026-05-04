'use client';
/**
 * Phase 7 Plan 01 — BFF wrappers for the banners (Advertisement) surface.
 *
 * Function bodies are STUBS — every function throws a "Plan 03 not landed yet"
 * error. Plan 03 fills the bodies with fetchWithRefresh + endpoint URLs.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/banners/*`.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BannerDetail,
    BannerListResponse,
    BannerCategoryRow,
    BannerUpsertInput,
    BannerStatus,
    BulkStatusToggleResult,
} from './types';

export const BANNERS_API_BASE = '/api/proxy/v1/admin/banners';
export const BANNER_CATEGORIES_API_BASE = '/api/proxy/v1/admin/banners/categories';

export interface ListBannersQuery {
    page?: number;
    page_size?: number;
    q?: string;
    status?: BannerStatus;
    category_id?: number;
    sort?: 'created_at' | 'updated_at' | 'visit_count';
    order?: 'asc' | 'desc';
}

// TODO Plan 03: implement
export async function listBanners(_q?: ListBannersQuery): Promise<BannerListResponse> {
    throw new Error('listBanners: stub — Plan 03 not landed yet');
}

// TODO Plan 03: implement
export async function getBanner(_id: number): Promise<BannerDetail> {
    throw new Error('getBanner: stub — Plan 03 not landed yet');
}

// TODO Plan 03: implement
export async function createBanner(_input: BannerUpsertInput): Promise<BannerDetail> {
    throw new Error('createBanner: stub — Plan 03 not landed yet');
}

// TODO Plan 03: implement
export async function updateBanner(_id: number, _input: Partial<BannerUpsertInput>): Promise<BannerDetail> {
    throw new Error('updateBanner: stub — Plan 03 not landed yet');
}

// TODO Plan 03: implement
export async function deleteBanner(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteBanner: stub — Plan 03 not landed yet');
}

// TODO Plan 03: implement
export async function bulkUpdateBannerStatus(_input: {
    mode: 'dry_run' | 'commit';
    banner_ids: number[];
    status: BannerStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    throw new Error('bulkUpdateBannerStatus: stub — Plan 03 not landed yet');
}

// Categories — TODO Plan 03
export async function listBannerCategories(): Promise<BannerCategoryRow[]> {
    throw new Error('listBannerCategories: stub — Plan 03 not landed yet');
}

export async function createBannerCategory(_input: {
    slug: string;
    title_ru: string;
    title_kz: string;
}): Promise<BannerCategoryRow> {
    throw new Error('createBannerCategory: stub — Plan 03 not landed yet');
}

export async function updateBannerCategory(
    _id: number,
    _input: Partial<{ slug: string; title_ru: string; title_kz: string }>,
): Promise<BannerCategoryRow> {
    throw new Error('updateBannerCategory: stub — Plan 03 not landed yet');
}

export async function deleteBannerCategory(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteBannerCategory: stub — Plan 03 not landed yet');
}

void fetchWithRefresh;
