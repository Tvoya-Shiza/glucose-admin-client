'use client';
/**
 * Phase 7 Plan 04 — BFF wrappers for the blogs surface.
 *
 * Endpoints route through the BFF proxy `/api/proxy/v1/admin/blogs/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api.
 *
 * Note (D-11): changeBlogAuthor mirrors the Phase 3 RoleChangeDialog audit
 * trail. Server validates target user has 'admin' or 'teacher' role + requires
 * `confirmation === String(blog.id)` (T-07-04-04).
 *
 * Note (BlogCategory schema — Plan 01 lock): BlogCategory has NO slug column.
 * createBlogCategory / updateBlogCategory take { title_ru, title_kz } only.
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

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);
    return (json as { message?: string })?.message ?? fallback;
}

// ──────────────────────────────────────────────────────────────────────────────
// Blogs CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listBlogs(q?: ListBlogsQuery): Promise<BlogListResponse> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}${buildQuery(q as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listBlogs failed: ${res.status}`);
    return res.json();
}

export async function getBlog(id: number): Promise<BlogDetail> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `getBlog failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogDetail>(json);
}

export async function createBlog(input: BlogUpsertInput): Promise<BlogDetail> {
    const res = await fetchWithRefresh(BLOGS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createBlog failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogDetail>(json);
}

export async function updateBlog(id: number, input: Partial<BlogUpsertInput>): Promise<BlogDetail> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateBlog failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogDetail>(json);
}

export async function deleteBlog(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBlog failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function bulkUpdateBlogStatus(input: {
    mode: 'dry_run' | 'commit';
    blog_ids: number[];
    status: BlogStatus;
    bulk_op_id?: string;
    confirmed_count?: number;
    reason?: string;
}): Promise<BulkStatusToggleResult> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}/bulk-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `bulkUpdateBlogStatus failed: ${res.status}`));
    return res.json();
}

/**
 * D-11 — author reassignment. Server validates target user has 'admin' or 'teacher'
 * role and requires `confirmation === String(id)` (T-07-04-04).
 */
export async function changeBlogAuthor(
    id: number,
    input: BlogChangeAuthorInput & { confirmation?: string },
): Promise<BlogDetail> {
    const res = await fetchWithRefresh(`${BLOGS_API_BASE}/${encodeURIComponent(String(id))}/author`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `changeBlogAuthor failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogDetail>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Blog categories  (NO slug field — schema-truth lock from Plan 01)
// ──────────────────────────────────────────────────────────────────────────────

export async function listBlogCategories(): Promise<BlogCategoryRow[]> {
    const res = await fetchWithRefresh(BLOG_CATEGORIES_API_BASE);
    if (!res.ok) throw new Error(`listBlogCategories failed: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === 'object' && 'rows' in (json as Record<string, unknown>)) {
        return (json as { rows: BlogCategoryRow[] }).rows;
    }
    return Array.isArray(json) ? (json as BlogCategoryRow[]) : [];
}

export async function getBlogCategory(id: number): Promise<BlogCategoryRow & { blog_count: number }> {
    const res = await fetchWithRefresh(`${BLOG_CATEGORIES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `getBlogCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogCategoryRow & { blog_count: number }>(json);
}

export async function createBlogCategory(input: {
    title_ru: string;
    title_kz: string;
}): Promise<BlogCategoryRow> {
    const res = await fetchWithRefresh(BLOG_CATEGORIES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createBlogCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogCategoryRow>(json);
}

export async function updateBlogCategory(
    id: number,
    input: Partial<{ title_ru: string; title_kz: string }>,
): Promise<BlogCategoryRow> {
    const res = await fetchWithRefresh(`${BLOG_CATEGORIES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateBlogCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BlogCategoryRow>(json);
}

export async function deleteBlogCategory(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${BLOG_CATEGORIES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBlogCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}
