/**
 * Phase 7 Plan 01 — shared blogs types.
 *
 * Schema reference (glucose-admin-api/prisma/schema.prisma lines 1164-1217):
 *   - Blog: id, category_id, author_id, slug, image (single cover; NO icon, NO video),
 *     visit_count, enable_comment, status (BlogStatus enum: 'pending'|'publish'),
 *     link_type, page_type, link, created_at (unix), updated_at (unix).
 *   - BlogTranslation: id, blog_id, locale, title, description (Text), content (LongText).
 *     NO @@unique([blog_id, locale]) — Plan 04 must use find-then-update inside $transaction.
 *   - BlogCategory: id ONLY (NO `slug` column — diverges from Story/Advertisement category schema).
 *   - BlogCategoryTranslation: blog_category_id, locale, title.
 *
 * SCHEMA-TRUTH LOCK:
 *   - NO `deleted_at`, NO `is_active`, NO `sort_order` columns on Blog.
 *   - "Soft delete" (D-12) = setting status to 'pending'.
 *   - Bulk-status (D-12) toggles between 'pending' and 'publish'.
 *   - BlogCategory has NO slug column (deviates from StoryCategory / AdvertisementCategory
 *     which both have `slug`). BlogCategoryRow below intentionally omits `slug`.
 *
 * D-11: author reassignment endpoint mirrors Phase 3 RoleChangeDialog. Plan 04
 * adds a dedicated changeBlogAuthor() wrapper with audit + reason trail.
 */
export type BlogStatus = 'pending' | 'publish';

export type Locale = 'ru' | 'kz';

export interface BlogTranslationRow {
    locale: Locale;
    title: string;
    description: string;
    /** Tiptap-rendered HTML; sanitized server-side in Plan 04 before persisting. */
    content: string;
}

export interface BlogRow {
    id: number;
    slug: string;
    image: string | null;
    status: BlogStatus;
    category_id: number;
    author_id: number;
    visit_count: number;
    created_at: number;
    updated_at: number;
    title_ru: string | null;
    title_kz: string | null;
    category_title_ru: string | null;
    author_full_name: string | null;
}

export interface BlogDetail extends BlogRow {
    enable_comment: boolean;
    link_type: string | null;
    page_type: string | null;
    link: string | null;
    translations: BlogTranslationRow[];
    /**
     * Plan 04 lock — admin-api detail response embeds the resolved category +
     * author shapes. BlogCategory has no slug column (schema-truth), hence
     * `id + title_ru + title_kz` only.
     */
    category: {
        id: number;
        title_ru: string | null;
        title_kz: string | null;
    } | null;
    /**
     * Plan 04 / D-11 — author shape needed by AuthorChangeDialog (mirrors RoleChangeDialog).
     * `role_name` is included for the read-only "current author" line in the dialog.
     */
    author: {
        id: number;
        full_name: string | null;
        role_name: string | null;
    } | null;
}

export interface BlogListResponse {
    rows: BlogRow[];
    total: number;
    pageCount: number;
}

/**
 * BlogCategory has NO `slug` column on the schema (verified at Phase 7 Plan 01
 * schema-truth pass). Only id + translations. Do NOT add slug here without a
 * matching schema change in glucose-api (which would also require an `Blogs are
 * admin-only` migration).
 */
export interface BlogCategoryRow {
    id: number;
    title_ru: string | null;
    title_kz: string | null;
}

export interface BlogUpsertInput {
    slug: string;
    category_id: number;
    image?: string | null;
    status?: BlogStatus;
    enable_comment?: boolean;
    link_type?: string | null;
    page_type?: string | null;
    link?: string | null;
    /** Each translation's `content` is Tiptap HTML; sanitized server-side. */
    translations: BlogTranslationRow[];
}

export interface BlogChangeAuthorInput {
    /** Target user ID. Server validates target user has admin/teacher role (D-11). */
    author_id: number;
    /** Optional human-readable reason captured into the audit log. */
    reason?: string;
}

export interface BulkStatusToggleResult {
    bulk_op_id: string;
    mode: 'dry_run' | 'commit';
    affected: number;
    insert: number;
    update: number;
    skip: number;
    error: number;
    rows: Array<{
        row_id: string;
        status: 'insert' | 'update' | 'skip' | 'error';
        reason: string | null;
    }>;
}
