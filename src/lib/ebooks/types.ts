/**
 * TS types mirroring admin-api «Электронды кітаптар» DTO shapes (Phase 39/40).
 *
 * Manually maintained — must change in lockstep with
 * glucose-admin-api/src/modules/ebooks/dto/*.dto.ts and the row/detail
 * projections in books.service.ts / book-pages.service.ts / publishers.service.ts.
 *
 * A book is a `books` row + a kz `book_translations` row (title/description) +
 * `book_pages` children. Consequences that matter for these types:
 *   - `title_kz` / `description_kz` are the kz BookTranslation columns, NOT
 *     columns on `books`.
 *   - `status` is a STORED column (draft | active | inactive) — unlike trainers,
 *     where publish_status is derived. Publication is changed ONLY through
 *     PATCH /ebooks/:id/publish (the page_count gate lives there); the metadata
 *     PATCH deliberately has no `status` field.
 *   - `page_count` is recomputed server-side as max(page_number) after every
 *     page mutation — never sent by the client.
 *
 * Ids:
 *   - Book.id, Publisher.id, subject_id, publisher_id are `Int` → `number`
 *     (math is safe).
 *   - BookPage.id IS a BigInt on the schema, but the admin page surface never
 *     exposes it: pages are addressed by (book_id, page_number) everywhere —
 *     list rows, batch upsert, and DELETE :bookId/pages/:pageNumber. Should a
 *     BigInt field ever surface here, type it as an opaque `string` and never
 *     call Number() on it.
 *   - Every timestamp (created_at, updated_at, deleted_at) is Unix SECONDS
 *     (`number`), NOT an ISO string.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Enums / unions
// ──────────────────────────────────────────────────────────────────────────────

export type BookStatus = 'draft' | 'active' | 'inactive';
export type Locale = 'kz';

// ──────────────────────────────────────────────────────────────────────────────
// Shared refs
// ──────────────────────────────────────────────────────────────────────────────

export interface BookSubjectRef {
    id: number;
    title_kz: string | null;
}

export interface BookPublisherRef {
    id: number;
    name: string;
}

export interface BookTranslation {
    locale: Locale;
    title: string;
    description: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// List (mirrors books.service.ts BookRowDto + list-books.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListBooksQuery {
    page?: number;
    /** Capped at 200 server-side; default 50. */
    page_size?: number;
    /** Matches the kz title (contains, case-insensitive via MySQL collation). */
    q?: string;
    status?: BookStatus;
    subject_id?: number;
    publisher_id?: number;
    /** 1..11. */
    grade?: number;
}

export interface BookRow {
    id: number;
    title_kz: string | null;
    subject: BookSubjectRef | null;
    publisher: BookPublisherRef | null;
    grade: number | null;
    language: string;
    /** Credit line as printed on the cover; display only (phase 42). */
    authors: string | null;
    year: number | null;
    cover_image: string | null;
    page_count: number;
    status: BookStatus;
    /** Unix seconds. */
    created_at: number;
}

export interface BookListResponse {
    rows: BookRow[];
    total: number;
    pageCount: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail (mirrors books.service.ts readDetail projection)
// ──────────────────────────────────────────────────────────────────────────────

export interface BookDetail {
    id: number;
    title_kz: string | null;
    /** Only the kz row is ever returned (kz-only locale). */
    translations: BookTranslation[];
    description_kz: string | null;
    subject: BookSubjectRef | null;
    publisher: BookPublisherRef | null;
    grade: number | null;
    language: string;
    /** Credit line as printed on the cover; display only (phase 42). */
    authors: string | null;
    year: number | null;
    cover_image: string | null;
    /** Original import artifact (PDF) — read-only in the admin. */
    source_file_url: string | null;
    page_count: number;
    status: BookStatus;
    /** Unix seconds. */
    created_at: number;
    /** Unix seconds. null when never updated. */
    updated_at: number | null;
    /** Unix seconds. Non-null ⇒ soft-deleted (publishing 'active' restores it). */
    deleted_at: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Book mutations — payloads (mirror create-book.dto.ts + update-book.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateBook {
    /** kz BookTranslation.title. Max 512. */
    title: string;
    /** kz BookTranslation.description. Max 10000. */
    description?: string;
    subject_id?: number;
    publisher_id?: number;
    /** 1..11. */
    grade?: number;
    /** Max 8 chars; server default 'kz'. */
    language?: string;
    /** Credit line, max 512, e.g. «Н.С. Бакина, Н.Т. Жанақова». */
    authors?: string;
    /** 1900..2100. */
    year?: number;
    /** URL produced by the uploads surface (max 512). */
    cover_image?: string;
    /**
     * Server default 'draft'. 'active' is REFUSED with 409 ebooks.publish_blocked
     * (a brand-new book has zero pages) — never send it from the create dialog.
     */
    status?: Exclude<BookStatus, 'active'>;
}

/**
 * Partial update. Every field optional:
 *   - undefined → leave unchanged
 *   - null      → clear (description, subject_id, publisher_id, grade, year,
 *                 authors, cover_image are the nullable columns)
 *
 * `status` is intentionally ABSENT — publication goes through publishBook().
 */
export interface UpdateBook {
    title?: string;
    description?: string | null;
    subject_id?: number | null;
    publisher_id?: number | null;
    grade?: number | null;
    language?: string;
    authors?: string | null;
    year?: number | null;
    cover_image?: string | null;
}

export interface PublishBook {
    status: BookStatus;
}

export interface PublishBookResult {
    id: number;
    status: BookStatus;
}

export interface DeleteBookResult {
    id: number;
    status: 'inactive';
    deleted: true;
}

/**
 * 409 body returned by PATCH /ebooks/:id/publish (and by POST /ebooks when
 * status='active' is requested) — a book with zero pages must never reach
 * students. Mirrors the service ConflictException `{ status, message, page_count }`.
 */
export interface BookPublishBlocked {
    status: 'ebooks.publish_blocked';
    message: string;
    page_count: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Pages (mirror book-pages.service.ts + replace-pages.dto.ts)
// ──────────────────────────────────────────────────────────────────────────────

export interface BookPageRow {
    page_number: number;
    image_url: string | null;
    /** Computed in SQL — the MediumText column itself is never transferred. */
    has_text: boolean;
}

/** GET /ebooks/:bookId/pages — NOTE: no `pageCount` (the page list is unpaginated). */
export interface BookPagesListResponse {
    rows: BookPageRow[];
    total: number;
}

/**
 * One entry of the batch upsert, keyed by (book_id, page_number).
 * Per-field merge: image_url / text_content are written only when PRESENT, so a
 * caller updating only images never wipes OCR text. Explicit null clears.
 */
export interface ReplacePageInput {
    page_number: number;
    image_url?: string | null;
    text_content?: string | null;
}

export interface ReplacePages {
    /** 1..2000 entries. */
    pages: ReplacePageInput[];
}

export interface ReplacePagesResult {
    book_id: number;
    /** Recomputed as max(page_number) after the batch. */
    page_count: number;
    upserted: number;
}

export interface DeletePageResult {
    book_id: number;
    page_number: number;
    page_count: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Publishers (mirror publishers.service.ts + list/upsert-publisher dto)
// ──────────────────────────────────────────────────────────────────────────────

export interface ListPublishersQuery {
    page?: number;
    /** Capped at 200 server-side; default 50. */
    page_size?: number;
    /** Matches Publisher.name (contains). */
    q?: string;
}

export interface PublisherRow {
    id: number;
    name: string;
    /** Books currently linked to this publisher. */
    book_count: number;
    /** Unix seconds. */
    created_at: number;
    /** Unix seconds. null when never updated. */
    updated_at: number | null;
}

export interface PublisherListResponse {
    rows: PublisherRow[];
    total: number;
    pageCount: number;
}

export interface UpsertPublisher {
    /** UNIQUE server-side — a duplicate rejects with 409 publishers.name_taken. */
    name: string;
}

export interface CreatePublisherResult {
    id: number;
    name: string;
    created_at: number;
}

export interface UpdatePublisherResult {
    id: number;
    name: string;
    updated_at: number | null;
}

/**
 * The FK is ON DELETE SET NULL, so deleting a publisher is safe — its books just
 * lose the link. `unlinked_books` reports how many were affected.
 */
export interface DeletePublisherResult {
    id: number;
    deleted: true;
    unlinked_books: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Search reindex (mirrors ebooks-reindex.controller.ts)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /ebooks/:id/reindex — best-effort Postgres projection rebuild. Returns
 * HTTP 200 even when indexing is disabled/down: `ok:false` + `reason` instead of
 * a 5xx (indexing must never block the admin).
 */
export interface ReindexBookResult {
    id: number;
    ok: boolean;
    indexed: number;
    reason?: string;
}
