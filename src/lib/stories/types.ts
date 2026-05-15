/**
 * Phase 7 Plan 01 — shared stories types.
 *
 * Schema reference (glucose-admin-api/prisma/schema.prisma):
 *   - Story: id, author_id, slug, image, icon, video, visit_count,
 *     enable_comment, status (BlogStatus enum: 'pending'|'publish'),
 *     link_type, page_type, link, created_at (unix), updated_at (unix).
 *   - StoryTranslation: id, story_id, locale, title, description (Text), content (LongText).
 *     NO @@unique([story_id, locale]) — Plan 02 must use find-then-update inside $transaction.
 *
 * SCHEMA-TRUTH LOCK:
 *   - NO `deleted_at`, NO `is_active`, NO `sort_order` columns.
 *   - "Soft delete" (D-07) = setting status to 'pending' (kept distinct from hard delete).
 *   - Bulk-status (D-07) toggles between 'pending' and 'publish'.
 *
 * BigInt convention: all Story IDs are `Int` on the schema → typed as
 * `number` here. The admin-api BigIntStringInterceptor only converts BigInt to
 * string; Int stays a number.
 */
export type StoryStatus = 'pending' | 'publish';

export type Locale = 'kz';

export interface StoryTranslationRow {
    locale: Locale;
    title: string;
    description: string;
    content: string;
}

export interface StoryRow {
    id: number;
    slug: string;
    image: string | null;
    icon: string | null;
    video: string | null;
    status: StoryStatus;
    author_id: number;
    visit_count: number;
    created_at: number;
    updated_at: number;
    /** Server-denormalized for table rendering (Plan 02 selects via translation join). */
    title_kz: string | null;
    author_full_name: string | null;
}

export interface StoryDetail extends StoryRow {
    enable_comment: boolean;
    link_type: string | null;
    page_type: string | null;
    link: string | null;
    translations: StoryTranslationRow[];
}

export interface StoryListResponse {
    rows: StoryRow[];
    total: number;
    pageCount: number;
}

export interface StoryUpsertInput {
    slug: string;
    image?: string | null;
    icon?: string | null;
    video?: string | null;
    status?: StoryStatus;
    enable_comment?: boolean;
    link_type?: string | null;
    page_type?: string | null;
    link?: string | null;
    translations: StoryTranslationRow[];
}

/**
 * Bulk-status toggle result — mirrors Phase 3 BulkSelection contract so DryRunDialog
 * + TypeTheCountConfirmation can be reused verbatim. `insert` is always 0 for
 * bulk-status flows (kept for parity with the import dialog's shape).
 */
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
