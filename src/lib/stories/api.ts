'use client';
/**
 * Phase 7 Plan 01 — BFF wrappers for the stories surface.
 *
 * Function bodies are STUBS — every function throws a "Plan 02 not landed yet"
 * error. Plan 02 fills the bodies with fetchWithRefresh + endpoint URLs. The
 * signatures are locked here so the UI components Plan 02 builds can import
 * stable types without circular planning dependencies.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/stories/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api (CLAUDE.md
 * "Bypassing the BFF proxy" forbidden).
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    StoryDetail,
    StoryListResponse,
    StoryCategoryRow,
    StoryUpsertInput,
    StoryStatus,
    BulkStatusToggleResult,
} from './types';

export const STORIES_API_BASE = '/api/proxy/v1/admin/stories';
export const STORY_CATEGORIES_API_BASE = '/api/proxy/v1/admin/stories/categories';

export interface ListStoriesQuery {
    page?: number;
    page_size?: number;
    q?: string;
    status?: StoryStatus;
    category_id?: number;
    sort?: 'created_at' | 'updated_at' | 'visit_count';
    order?: 'asc' | 'desc';
}

// TODO Plan 02: implement
export async function listStories(_q?: ListStoriesQuery): Promise<StoryListResponse> {
    throw new Error('listStories: stub — Plan 02 not landed yet');
}

// TODO Plan 02: implement
export async function getStory(_id: number): Promise<StoryDetail> {
    throw new Error('getStory: stub — Plan 02 not landed yet');
}

// TODO Plan 02: implement
export async function createStory(_input: StoryUpsertInput): Promise<StoryDetail> {
    throw new Error('createStory: stub — Plan 02 not landed yet');
}

// TODO Plan 02: implement
export async function updateStory(_id: number, _input: Partial<StoryUpsertInput>): Promise<StoryDetail> {
    throw new Error('updateStory: stub — Plan 02 not landed yet');
}

// TODO Plan 02: implement
export async function deleteStory(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteStory: stub — Plan 02 not landed yet');
}

// TODO Plan 02: implement
export async function bulkUpdateStoryStatus(_input: {
    mode: 'dry_run' | 'commit';
    story_ids: number[];
    status: StoryStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    throw new Error('bulkUpdateStoryStatus: stub — Plan 02 not landed yet');
}

// Categories — TODO Plan 02
export async function listStoryCategories(): Promise<StoryCategoryRow[]> {
    throw new Error('listStoryCategories: stub — Plan 02 not landed yet');
}

export async function createStoryCategory(_input: {
    slug: string;
    title_ru: string;
    title_kz: string;
}): Promise<StoryCategoryRow> {
    throw new Error('createStoryCategory: stub — Plan 02 not landed yet');
}

export async function updateStoryCategory(
    _id: number,
    _input: Partial<{ slug: string; title_ru: string; title_kz: string }>,
): Promise<StoryCategoryRow> {
    throw new Error('updateStoryCategory: stub — Plan 02 not landed yet');
}

export async function deleteStoryCategory(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteStoryCategory: stub — Plan 02 not landed yet');
}

// Plan 02 will use fetchWithRefresh inside the stubs above; the import is held
// here so TS doesn't strip it during the stub→real transition.
void fetchWithRefresh;
