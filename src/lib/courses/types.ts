/**
 * TS types mirroring admin-api Courses DTO shapes (Phase 5 Plan 01).
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/courses/dto/*.dto.ts.
 *
 * BigInt note (admin-client CLAUDE.md "BigInt-as-string from admin-api"):
 *   - Webinar.id, WebinarChapter.id, WebinarChapterItem.id, Files.id are `Int` on
 *     the schema → typed as `number` here.
 *   - WebinarChapterSchedule.id is `BigInt @db.UnsignedBigInt` on the schema —
 *     serialized as STRING by admin-api's BigIntStringInterceptor → typed as
 *     `string` here. Treat as opaque IDs; do NOT call Number(value) on them.
 *
 * Schema-truth reconciliations (carried from Plan 01 — see
 * glucose-admin-api/src/modules/courses/dto/course-detail.dto.ts header for full notes):
 *   - WebinarChapterItemType = 'file' | 'quiz' | 'assignment' (NOT text|image|video).
 *     UI sub-types ("rich text" / "image" / "video") are derived in admin-client from
 *     the linked Files row's file_type MIME prefix.
 *   - There is NO WebinarChapterItemTranslations model — per-locale rich-text bodies
 *     for items live in FileTranslations.description (LongText) when type='file'.
 *   - WebinarChapterSchedule has no webinar_id / chapter_id columns; it links via
 *     webinar_chapter_item_id only.
 *   - Webinar.thumbnail and Webinar.image_cover are NOT NULL (default '').
 *   - Webinar.deleted_at exists (soft-delete supported).
 */

// ──────────────────────────────────────────────────────────────────────────────
// Enums / unions
// ──────────────────────────────────────────────────────────────────────────────

export type CourseStatus = 'active' | 'pending' | 'is_draft' | 'inactive';
export type CreateCourseStatus = 'active' | 'pending' | 'is_draft';
export type CourseType = 'webinar' | 'course' | 'text_lesson';
export type Locale = 'kz';
export type TranslationCompleteness = 'complete' | 'incomplete';
export type CourseSortField = 'created_at' | 'updated_at' | 'teacher' | 'slug';
export type SortOrder = 'asc' | 'desc';
export type ChapterStatus = 'active' | 'inactive';
export type ChapterItemType = 'file' | 'quiz' | 'assignment';
export type UploadKind = 'image' | 'video' | 'cover';
export type UploadContentType =
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'video/mp4'
    | 'video/webm';

// ──────────────────────────────────────────────────────────────────────────────
// Translation
// ──────────────────────────────────────────────────────────────────────────────

export interface Translation {
    locale: Locale;
    title: string;
    description?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// List
// ──────────────────────────────────────────────────────────────────────────────

export interface TeacherRef {
    id: number;
    full_name: string | null;
}

export interface CategoryRef {
    id: number;
    slug: string;
    /** KZ title from WebinarCategoryTranslations. null when not translated — UI should
     *  fall back to slug so the row never renders blank. */
    title_kz: string | null;
}

export interface CourseRow {
    id: number;
    slug: string;
    /** KZ title from WebinarTranslations join. null when missing. */
    title_kz: string | null;
    status: CourseStatus;
    teacher: TeacherRef | null;
    category: CategoryRef | null;
    image_cover: string;
    translation_completeness: TranslationCompleteness;
    missing_locales: Locale[];
    /**
     * Count of WebinarChapter rows whose `webinar_id === this.id`. Surfaced for the
     * Plan 02 DeleteCourseDialog cascade copy + TypeTheCountConfirmation gate.
     * Computed via Prisma `_count.chapters` server-side — no N+1.
     */
    chapter_count: number;
    created_at: number;
    updated_at: number | null;
}

export interface CourseListResponse {
    rows: CourseRow[];
    total: number;
    page: number;
    page_size: number;
}

export interface ListCoursesQuery {
    page?: number;
    page_size?: number;
    status?: CourseStatus;
    teacher_id?: number;
    category_id?: number;
    translation_completeness?: TranslationCompleteness;
    q?: string;
    sort?: CourseSortField;
    order?: SortOrder;
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail
// ──────────────────────────────────────────────────────────────────────────────

export interface CourseDetailTeacherRef {
    id: number;
    full_name: string | null;
    email: string | null;
}

export interface CourseDetailCategoryRef {
    id: number;
    slug: string;
    title_kz: string | null;
}

export type FileAccessibility = 'free' | 'paid';

export interface ChapterItemFileRef {
    id: number;
    file_type: string;
    storage: string;
    file: string;
    volume: string;
    /** Phase 13: per-item access gate. Mirrors Files.accessibility on the schema. */
    accessibility?: FileAccessibility;
}

export interface ChapterItemQuizRef {
    id: number;
    slug: string;
}

export interface ChapterItemAssignmentRef {
    id: number;
    /** KZ title from WebinarAssignmentTranslation. Empty string when not translated. */
    title: string;
}

export interface ChapterItem {
    id: number;
    type: ChapterItemType;
    order: number | null;
    item_id: number;
    /**
     * Phase 16 — `true` means the item counts toward course completion.
     * UI surfaces this as a single "Обязательный для прохождения курса" checkbox in
     * UpsertItemDialog; default is `true` to preserve pre-Phase-16 semantics.
     */
    is_required: boolean;
    /**
     * Phase 20 — per-item content access gate (free | paid). Applies to ALL types
     * (file / quiz / assignment). For type='file' the linked Files.accessibility
     * is kept in sync server-side; the item-level value is the source of truth
     * for content-tree gating.
     */
    accessibility: FileAccessibility;
    file: ChapterItemFileRef | null;
    quiz: ChapterItemQuizRef | null;
    assignment: ChapterItemAssignmentRef | null;
    /** Only present (non-empty) when type='file' — derived from FileTranslations join. */
    translations: Translation[];
}

export interface Chapter {
    id: number;
    order: number | null;
    status: ChapterStatus;
    translations: Translation[];
    items: ChapterItem[];
}

export interface CourseCounts {
    chapter_count: number;
    item_count: number;
    schedule_count: number;
}

export interface CoursePricing {
    /** Decimal as string for arbitrary precision (matches admin-api Decimal(15,3)). */
    price: string;
    access_days: number;
}

export interface CourseDetail {
    id: number;
    slug: string;
    type: CourseType;
    status: CourseStatus;
    teacher: CourseDetailTeacherRef | null;
    category: CourseDetailCategoryRef | null;
    image_cover: string;
    thumbnail: string;
    capacity: number | null;
    certificate: boolean;
    /** Phase 13: paid course flag. When true, `pricing` is non-null. */
    is_paid: boolean;
    /**
     * Phase 16: course-level strict completion check.
     * Independent of `is_paid` — admin can opt a free course in, or a paid course out.
     * When true, the user-API treats `is_required` items as gating course completion
     * and surfaces `is_strict_required` on progress responses so the UI can show
     * "still missing N required items".
     */
    strict_progress: boolean;
    pricing: CoursePricing | null;
    start_date: number | null;
    duration: number | null;
    position: number | null;
    created_at: number;
    updated_at: number | null;
    deleted_at: number | null;
    translations: Translation[];
    translation_completeness: TranslationCompleteness;
    missing_locales: Locale[];
    chapters: Chapter[];
    counts: CourseCounts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations — payloads
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateCoursePayload {
    slug: string;
    type?: CourseType;
    status: CreateCourseStatus;
    teacher_id: number;
    category_id?: number | null;
    image_cover?: string;
    thumbnail?: string;
    translations: Translation[];
    /** Phase 13 pricing. When `is_paid=true`, `price` + `access_days` are required. */
    is_paid?: boolean;
    price?: number;
    access_days?: number;
    /** Phase 16 — strict completion check toggle. Optional on create (defaults false). */
    strict_progress?: boolean;
    /** Estimated study time in MINUTES. Optional — null/undefined = unknown. */
    duration?: number;
}

export interface UpdateCoursePayload {
    slug?: string;
    status?: CourseStatus;
    category_id?: number | null;
    image_cover?: string;
    thumbnail?: string;
    translations?: Translation[];
    is_paid?: boolean;
    price?: number;
    access_days?: number;
    /** Phase 16. */
    strict_progress?: boolean;
    /** Estimated study time in MINUTES. Pass `null` to clear. */
    duration?: number | null;
}

export interface ChangeTeacherPayload {
    teacher_id: number;
    reason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reorder
// ──────────────────────────────────────────────────────────────────────────────

export interface ReorderChapterEntry {
    id: number;
    order: number;
}

export interface ReorderItemEntry {
    id: number;
    chapter_id: number;
    order: number;
}

export interface ReorderPayload {
    chapters?: ReorderChapterEntry[];
    items?: ReorderItemEntry[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Chapter / Item upserts
// ──────────────────────────────────────────────────────────────────────────────

export interface UpsertChapterPayload {
    /** Omit on create. Present (matching path) on update. */
    id?: number;
    order?: number;
    status?: ChapterStatus;
    /** Chapter title only — description is ignored on this path (schema has no column). */
    translations?: Translation[];
}

export interface UpsertItemPayload {
    /** Omit on create. Present on update. */
    id?: number;
    chapter_id: number;
    type: ChapterItemType;
    /** FK to Files / Quizzes / WebinarAssignment depending on type. Pass `0`
     *  on create when `type='file'` — the server spawns a fresh Files row from
     *  the (file_url, file_type, volume, storage) bundle below. */
    item_id: number;
    order?: number;
    /** Only honored when type='file' (maps to FileTranslations). Ignored otherwise. */
    translations?: Translation[];
    /**
     * Phase 16 — per-item "counts toward completion" flag. Default `true` on the
     * server. Omitting the field on update keeps the existing value.
     */
    is_required?: boolean;
    /** Only honored when type='file'. Used both on create (item_id=0) to
     *  populate the new Files row and on update to patch the linked Files row. */
    accessibility?: FileAccessibility;
    file_url?: string;
    file_type?: string;
    volume?: string;
    /** Maps to Files.storage enum. 'upload' for binary uploads,
     *  'youtube' | 'vimeo' | 'iframe' for embedded video / external iframe targets. */
    storage?: 'upload' | 'youtube' | 'vimeo' | 'iframe' | 'external_link' | 'google_drive' | 'dropbox' | 's3' | 'upload_archive' | 'secure_host';
}

// ──────────────────────────────────────────────────────────────────────────────
// Schedule (BigInt id → string)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Joined item ref surfaced on each schedule row so the UI can label the row
 * without an extra round-trip. type/item_id are echoed for icon-rendering.
 */
export interface ScheduleItemRef {
    id: number;
    type: ChapterItemType;
    item_id: number;
    order: number | null;
}

/**
 * Joined chapter ref surfaced on each schedule row. The UI groups schedules
 * by chapter.id and uses the chapter's translation title for the section header.
 */
export interface ScheduleChapterRef {
    id: number;
    order: number | null;
    translations: Translation[];
}

export interface ScheduleRow {
    /** BigInt on schema, string on the wire. */
    id: string;
    teacher_id: number;
    group_id: number;
    webinar_chapter_item_id: number;
    start_date: number;
    end_date: number;
    is_before_start: boolean;
    expiration_check: boolean;
    /** ISO timestamps from admin-api (DateTime on schema). */
    created_at: string;
    updated_at: string;
    /** Joined item ref (server-side select). */
    item: ScheduleItemRef | null;
    /** Joined chapter ref (server-side select). The UI groups by this. */
    chapter: ScheduleChapterRef | null;
}

export interface ScheduleListResponse {
    rows: ScheduleRow[];
}

export interface ScheduleUpsertPayload {
    /** Omit on create; required (string) on update. */
    id?: string;
    webinar_chapter_item_id: number;
    group_id: number;
    /** Unix seconds. */
    start_date: number;
    /** Unix seconds. Must be >= start_date. */
    end_date: number;
    is_before_start: boolean;
    expiration_check: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Upload tokens
// ──────────────────────────────────────────────────────────────────────────────

export interface UploadTokenRequest {
    kind: UploadKind;
    size: number;
    content_type: UploadContentType;
}

export interface UploadTokenResponse {
    upload_url: string;
    token: string;
    expires_at: number;
    max_size: number;
    allowed_content_types: string[];
}

export interface UploadFileResult {
    file_url: string;
    content_type: string;
    size: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Preview-as-student (Plan 07 — CRS-09)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Preview response shape — mirror of the read-only "preview as student" endpoint
 * (GET /admin-api/v1/admin/courses/:id/preview?group_id=).
 *
 * Distinct from CourseDetail: drops admin-only fields (capacity, certificate, etc.)
 * and adds visibility flags + a `now` server timestamp + group_context. The
 * PreviewRenderer in admin-client uses `visible_now` per item as the gate for
 * "show full content" vs "show 'not visible' placeholder".
 *
 * The endpoint is an in-place mirror — NO impersonation. The admin-client
 * surfaces a banner so operators don't confuse this for a real student session.
 */
export interface PreviewFileTranslation {
    locale: Locale;
    title: string;
    description: string | null;
}

export interface PreviewFileRef {
    id: number;
    file: string;
    file_type: string;
    /** Files.storage enum value. Mirrors backend PreviewFileRef.storage. */
    storage: string;
    volume: string;
    translations: PreviewFileTranslation[];
}

export interface PreviewScheduleWindow {
    start_date: number;
    end_date: number;
    is_before_start: boolean;
    expiration_check: boolean;
}

export interface PreviewChapterItem {
    id: number;
    type: ChapterItemType;
    order: number | null;
    item_id: number;
    /** When ?group_id was omitted, always true. Otherwise derived from schedule window. */
    visible_now: boolean;
    /** null when no schedule exists for this (group, item) pair, or when group_id was omitted. */
    schedule_window: PreviewScheduleWindow | null;
    file: PreviewFileRef | null;
    quiz: { id: number } | null;
    assignment: { id: number } | null;
}

export interface PreviewChapter {
    id: number;
    order: number | null;
    status: ChapterStatus;
    translations: { locale: Locale; title: string }[];
    items: PreviewChapterItem[];
}

export interface PreviewGroupContext {
    id: number;
    name: string;
}

export interface CoursePreview {
    id: number;
    slug: string;
    type: CourseType;
    status: CourseStatus;
    image_cover: string;
    thumbnail: string;
    translations: Translation[];
    chapters: PreviewChapter[];
    /** null when ?group_id was omitted. */
    group_context: PreviewGroupContext | null;
    /** Server's "now" in Unix seconds. */
    now: number;
}
