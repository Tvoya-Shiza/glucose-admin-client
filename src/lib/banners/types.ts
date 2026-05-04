/**
 * Phase 7 Plan 01 — shared banners types.
 *
 * Schema reference (glucose-admin-api/prisma/schema.prisma lines 1219-1273):
 *   - Advertisement: id, category_id, author_id, slug, image, video,
 *     visit_count, enable_comment, status (BlogStatus enum: 'pending'|'publish'),
 *     link_type, page_type, link, created_at (unix), updated_at (unix).
 *     NOTE: Advertisement has NO `icon` column (unlike Story).
 *   - AdvertisementTranslation: id, advertisement_id, locale, title,
 *     description (Text), content (LongText). NO @@unique([advertisement_id, locale]).
 *   - AdvertisementCategory: id, slug; flat (no parent_id).
 *   - AdvertisementCategoryTranslation: advertisement_category_id, locale, title.
 *
 * SCHEMA-TRUTH LOCK:
 *   - NO `deleted_at`, NO `is_active`, NO `sort_order` columns.
 *   - "Soft delete" (D-08) = setting status to 'pending'.
 *   - Bulk-status (D-08) toggles between 'pending' and 'publish'.
 *   - Product-facing nomenclature is "Banner"; Prisma model is `Advertisement`.
 */
export type BannerStatus = 'pending' | 'publish';

export type Locale = 'ru' | 'kz';

export interface BannerTranslationRow {
    locale: Locale;
    title: string;
    description: string;
    content: string;
}

export interface BannerRow {
    id: number;
    slug: string;
    image: string | null;
    video: string | null;
    status: BannerStatus;
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

export interface BannerDetail extends BannerRow {
    enable_comment: boolean;
    link_type: string | null;
    page_type: string | null;
    link: string | null;
    translations: BannerTranslationRow[];
}

export interface BannerListResponse {
    rows: BannerRow[];
    total: number;
    pageCount: number;
}

export interface BannerCategoryRow {
    id: number;
    slug: string;
    title_ru: string | null;
    title_kz: string | null;
}

export interface BannerUpsertInput {
    slug: string;
    category_id: number;
    image?: string | null;
    video?: string | null;
    status?: BannerStatus;
    enable_comment?: boolean;
    link_type?: string | null;
    page_type?: string | null;
    link?: string | null;
    translations: BannerTranslationRow[];
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
