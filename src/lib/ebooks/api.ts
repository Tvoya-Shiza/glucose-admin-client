import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    BookDetail,
    BookListResponse,
    BookPagesListResponse,
    BookPublishBlocked,
    CreateBook,
    CreatePublisherResult,
    DeleteBookResult,
    DeletePageResult,
    DeletePublisherResult,
    ListBooksQuery,
    ListPublishersQuery,
    PublishBook,
    PublishBookResult,
    PublisherListResponse,
    ReindexBookResult,
    ReplacePages,
    ReplacePagesResult,
    UpdateBook,
    UpdatePublisherResult,
    UpsertPublisher,
} from './types';

/**
 * Typed wrappers around the admin-api «Электронды кітаптар» endpoints (Phase 39/40).
 *
 * Structure mirrors src/lib/quizzes/api.ts and src/lib/trainers/api.ts verbatim:
 * everything routes through the BFF proxy under `/api/proxy/v1/admin/ebooks/*`
 * and `/api/proxy/v1/admin/publishers/*`. The browser NEVER attaches a Bearer
 * token to admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden) —
 * the proxy Route Handler injects it server-side.
 *
 * Response envelope contract (from admin-api CLAUDE.md):
 *   - LIST endpoints (books list, pages list, publishers list) return their raw
 *     shape — `{ rows, total, pageCount }`, or `{ rows, total }` for pages
 *     (unpaginated) — consumed directly.
 *   - SINGLE-resource + mutation endpoints wrap with apiResponse({ data }) — the
 *     private `unwrapData` helper peels the envelope.
 *
 * Route map (admin-api controllers):
 *   GET    /ebooks                        list          ebooks.view
 *   GET    /ebooks/:id                    detail        ebooks.view
 *   POST   /ebooks                        create        ebooks.create
 *   PATCH  /ebooks/:id                    update        ebooks.edit
 *   PATCH  /ebooks/:id/publish            publish       ebooks.publish
 *   DELETE /ebooks/:id                    soft-delete   ebooks.delete
 *   POST   /ebooks/:id/reindex            reindex       ebooks.edit
 *   GET    /ebooks/:bookId/pages          pages list    ebooks.view
 *   PUT    /ebooks/:bookId/pages          batch upsert  ebooks.pages_manage
 *   DELETE /ebooks/:bookId/pages/:number  page delete   ebooks.pages_manage
 *   GET    /publishers                    list          ebooks.view
 *   POST   /publishers                    create        ebooks.edit
 *   PATCH  /publishers/:id                update        ebooks.edit
 *   DELETE /publishers/:id                delete        ebooks.edit
 */

export const EBOOKS_API_BASE = '/api/proxy/v1/admin/ebooks';
export const PUBLISHERS_API_BASE = '/api/proxy/v1/admin/publishers';

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

/**
 * Typed error thrown by `createBook` / `publishBook` when the server refuses to
 * make a book 'active' because it has zero pages. Carries `page_count` so the
 * toast can explain the reason.
 *
 * Nest's default exception filter wraps a ConflictException constructed with an
 * object under `response.message` when that body is an object; we tolerate both
 * the nested and the flat shape (same posture as TrainerPublishBlockedError).
 */
export class BookPublishBlockedError extends Error {
    public readonly page_count: number;
    public readonly status = 'ebooks.publish_blocked' as const;

    constructor(body: BookPublishBlocked) {
        super(body.message ?? 'ebooks.publish_blocked');
        this.name = 'BookPublishBlockedError';
        this.page_count = body.page_count;
    }
}

/** Peels the 409 body and throws BookPublishBlockedError when it is the publish gate. */
async function throwIfPublishBlocked(res: Response): Promise<void> {
    if (res.status !== 409) return;
    const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
    const inner =
        body && typeof body === 'object' && body.message && typeof body.message === 'object'
            ? (body.message as Record<string, unknown>)
            : body;
    const status = String(inner.status ?? body.status ?? '');
    if (status === 'ebooks.publish_blocked') {
        throw new BookPublishBlockedError({
            status: 'ebooks.publish_blocked',
            message: String(inner.message ?? body.message ?? 'ebooks.publish_blocked'),
            page_count: Number(inner.page_count ?? body.page_count ?? 0),
        });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Books CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listBooks(query?: ListBooksQuery): Promise<BookListResponse> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listBooks failed: ${res.status}`);
    return res.json();
}

export async function getBook(id: number): Promise<BookDetail> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getBook failed: ${res.status}`);
    const json = await res.json();
    return unwrapData<BookDetail>(json);
}

export async function createBook(payload: CreateBook): Promise<BookDetail> {
    const res = await fetchWithRefresh(EBOOKS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfPublishBlocked(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `createBook failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BookDetail>(json);
}

export async function updateBook(id: number, payload: UpdateBook): Promise<BookDetail> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateBook failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<BookDetail>(json);
}

export async function deleteBook(id: number): Promise<DeleteBookResult> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBook failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<DeleteBookResult>(json);
}

export async function publishBook(id: number, payload: PublishBook): Promise<PublishBookResult> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(id))}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfPublishBlocked(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `publishBook failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<PublishBookResult>(json);
}

/**
 * Manual rebuild of the book's Postgres search projection. Always HTTP 200 when
 * the book exists — inspect `ok` / `reason` to tell a real rebuild from a no-op
 * (`search_index_disabled` when SEARCH_DATABASE_URL is unset).
 */
export async function reindexBook(id: number): Promise<ReindexBookResult> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(id))}/reindex`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `reindexBook failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<ReindexBookResult>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Book pages
// ──────────────────────────────────────────────────────────────────────────────

export async function listBookPages(bookId: number): Promise<BookPagesListResponse> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(bookId))}/pages`);
    if (!res.ok) throw new Error(`listBookPages failed: ${res.status}`);
    return res.json();
}

/**
 * Batch upsert by (book_id, page_number). REPLACE semantics per listed page;
 * pages NOT listed are left alone (this is not a full-collection replace).
 */
export async function replaceBookPages(bookId: number, payload: ReplacePages): Promise<ReplacePagesResult> {
    const res = await fetchWithRefresh(`${EBOOKS_API_BASE}/${encodeURIComponent(String(bookId))}/pages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `replaceBookPages failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<ReplacePagesResult>(json);
}

/** Pages are addressed by page_number (not by their BigInt row id). */
export async function deleteBookPage(bookId: number, pageNumber: number): Promise<DeletePageResult> {
    const res = await fetchWithRefresh(
        `${EBOOKS_API_BASE}/${encodeURIComponent(String(bookId))}/pages/${encodeURIComponent(String(pageNumber))}`,
        { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBookPage failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<DeletePageResult>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Publishers CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listPublishers(query?: ListPublishersQuery): Promise<PublisherListResponse> {
    const res = await fetchWithRefresh(`${PUBLISHERS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listPublishers failed: ${res.status}`);
    return res.json();
}

export async function createPublisher(payload: UpsertPublisher): Promise<CreatePublisherResult> {
    const res = await fetchWithRefresh(PUBLISHERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createPublisher failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CreatePublisherResult>(json);
}

export async function updatePublisher(id: number, payload: UpsertPublisher): Promise<UpdatePublisherResult> {
    const res = await fetchWithRefresh(`${PUBLISHERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updatePublisher failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<UpdatePublisherResult>(json);
}

export async function deletePublisher(id: number): Promise<DeletePublisherResult> {
    const res = await fetchWithRefresh(`${PUBLISHERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deletePublisher failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<DeletePublisherResult>(json);
}
