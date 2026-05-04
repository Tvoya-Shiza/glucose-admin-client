'use client';
/**
 * Phase 7 Plan 01 — BFF wrappers for the blogs surface.
 *
 * Function bodies are STUBS — every function throws a "Plan 04 not landed yet"
 * error. Plan 04 fills the bodies with fetchWithRefresh + endpoint URLs.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/blogs/*`.
 *
 * Note (D-11): changeBlogAuthor mirrors the Phase 3 RoleChangeDialog audit
 * trail. Server-side validation (target must be admin or teacher) lives in Plan 04.
 *
 * Note (BlogCategory schema): the BlogCategory model has NO slug column — see
 * blogs/types.ts comment. createBlogCategory / updateBlogCategory therefore take
 * { title_ru, title_kz } only (no slug field).
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BlogDetail,
    BlogListResponse,
    BlogCategoryRow,
    BlogUpsertInput,
    BlogStatus,
    BlogChangeAuthorInput,
    BulkStatusToggleResult,
} from './types';

export const BLOGS_API_BASE = '/api/proxy/v1/admin/blogs';
export const BLOG_CATEGORIES_API_BASE = '/api/proxy/v1/admin/blogs/categories';

export interface ListBlogsQuery {
    page?: number;
    page_size?: number;
    q?: string;
    status?: BlogStatus;
    category_id?: number;
    author_id?: number;
    sort?: 'created_at' | 'updated_at' | 'visit_count';
    order?: 'asc' | 'desc';
}

// TODO Plan 04: implement
export async function listBlogs(_q?: ListBlogsQuery): Promise<BlogListResponse> {
    throw new Error('listBlogs: stub — Plan 04 not landed yet');
}

// TODO Plan 04: implement
export async function getBlog(_id: number): Promise<BlogDetail> {
    throw new Error('getBlog: stub — Plan 04 not landed yet');
}

// TODO Plan 04: implement
export async function createBlog(_input: BlogUpsertInput): Promise<BlogDetail> {
    throw new Error('createBlog: stub — Plan 04 not landed yet');
}

// TODO Plan 04: implement
export async function updateBlog(_id: number, _input: Partial<BlogUpsertInput>): Promise<BlogDetail> {
    throw new Error('updateBlog: stub — Plan 04 not landed yet');
}

// TODO Plan 04: implement
export async function deleteBlog(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteBlog: stub — Plan 04 not landed yet');
}

// TODO Plan 04: implement
export async function bulkUpdateBlogStatus(_input: {
    mode: 'dry_run' | 'commit';
    blog_ids: number[];
    status: BlogStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    throw new Error('bulkUpdateBlogStatus: stub — Plan 04 not landed yet');
}

/**
 * D-11 — author reassignment. Mirrors Phase 3 RoleChangeDialog audit trail.
 * Server validates target user has 'admin' or 'teacher' role.
 */
// TODO Plan 04: implement
export async function changeBlogAuthor(_id: number, _input: BlogChangeAuthorInput): Promise<BlogDetail> {
    throw new Error('changeBlogAuthor: stub — Plan 04 not landed yet');
}

// Categories — TODO Plan 04. NOTE: BlogCategory has no slug column on schema.
export async function listBlogCategories(): Promise<BlogCategoryRow[]> {
    throw new Error('listBlogCategories: stub — Plan 04 not landed yet');
}

export async function createBlogCategory(_input: {
    title_ru: string;
    title_kz: string;
}): Promise<BlogCategoryRow> {
    throw new Error('createBlogCategory: stub — Plan 04 not landed yet');
}

export async function updateBlogCategory(
    _id: number,
    _input: Partial<{ title_ru: string; title_kz: string }>,
): Promise<BlogCategoryRow> {
    throw new Error('updateBlogCategory: stub — Plan 04 not landed yet');
}

export async function deleteBlogCategory(_id: number): Promise<{ id: number; deleted: true }> {
    throw new Error('deleteBlogCategory: stub — Plan 04 not landed yet');
}

void fetchWithRefresh;
