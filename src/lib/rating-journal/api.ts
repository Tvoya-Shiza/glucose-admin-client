import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CellHistoryListResponse,
    CreateColumnPayload,
    CreateJournalPayload,
    JournalColumn,
    JournalGrid,
    JournalListResponse,
    JournalRef,
    ListCellHistoryQuery,
    ListJournalsQuery,
    ReorderColumnsPayload,
    UpdateCellPayload,
    UpdateColumnPayload,
    UpdatedCell,
} from './types';

/**
 * Typed wrappers around the admin-api «Рейтинг-журнал» (rating journal) endpoints.
 *
 * All calls route through the BFF proxy — the browser never attaches a Bearer
 * token to admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 *
 * Envelope contract (mirrors lib/credits/api.ts):
 *   - list / grid / history endpoints return the RAW shape (TanStack consumes
 *     it directly).
 *   - mutations return the apiResponse envelope `{ success, status, message,
 *     data }` — unwrapped via unwrapData / unwrapNested.
 */

export const RATING_JOURNAL_API_BASE = '/api/proxy/v1/admin/rating-journal';

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

/** Unwrap apiResponse `data`, then an optional single-key nesting ({column}/{cell}…). */
function unwrapNested<T>(json: unknown, key: string): T {
    const data = unwrapData<Record<string, unknown>>(json);
    if (data && typeof data === 'object' && key in data && data[key]) {
        return data[key] as T;
    }
    return data as unknown as T;
}

// ──────────────────────────────────────────────────────────────────────────────
// Typed error
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generic admin-api error for the rating-journal domain. `code` is the machine
 * code from the response body (`rating_journal.*`) or '' when the body had none.
 */
export class RatingJournalApiError extends Error {
    public readonly code: string;
    public readonly httpStatus: number;
    public readonly details: Record<string, unknown>;

    constructor(code: string, httpStatus: number, message: string, details: Record<string, unknown> = {}) {
        super(message);
        this.name = 'RatingJournalApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
    }
}

interface ParsedErrorBody {
    code: string;
    message: string;
    inner: Record<string, unknown>;
}

async function parseErrorBody(res: Response): Promise<ParsedErrorBody> {
    const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
    const inner =
        body && typeof body === 'object' && body.message && typeof body.message === 'object'
            ? (body.message as Record<string, unknown>)
            : body;
    const code = String(inner.code ?? inner.status ?? body.code ?? body.status ?? '');
    const message =
        typeof inner.trans === 'string'
            ? inner.trans
            : typeof body.trans === 'string'
              ? (body.trans as string)
              : typeof inner.message === 'string'
                ? (inner.message as string)
                : typeof body.message === 'string'
                  ? (body.message as string)
                  : '';
    return { code: code.includes('.') ? code : '', message, inner };
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
    const parsed = await parseErrorBody(res);
    throw new RatingJournalApiError(parsed.code, res.status, parsed.message || fallback, parsed.inner);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// ──────────────────────────────────────────────────────────────────────────────
// Grid + journal list / create
// ──────────────────────────────────────────────────────────────────────────────

/** RAW JournalGrid for a (group, course) pair. */
export async function getJournalGrid(args: {
    group_id: number;
    course_id: number;
    /** Optional calendar filter (item 5) — unix seconds, inclusive. */
    date_from?: number;
    date_to?: number;
}): Promise<JournalGrid> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/grid${buildQuery(args as Record<string, unknown>)}`);
    if (!res.ok) return throwApiError(res, `getJournalGrid failed: ${res.status}`);
    return (await res.json()) as JournalGrid;
}

export async function listJournals(query?: ListJournalsQuery): Promise<JournalListResponse> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) return throwApiError(res, `listJournals failed: ${res.status}`);
    return (await res.json()) as JournalListResponse;
}

export async function createJournal(payload: CreateJournalPayload): Promise<JournalRef> {
    const res = await fetchWithRefresh(RATING_JOURNAL_API_BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createJournal failed: ${res.status}`);
    return unwrapData<JournalRef>(await res.json());
}

/** RAW fresh JournalGrid after re-syncing auto columns from source content. */
export async function syncJournal(id: string): Promise<JournalGrid> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/${encodeURIComponent(id)}/sync`, {
        method: 'POST',
        headers: JSON_HEADERS,
    });
    if (!res.ok) return throwApiError(res, `syncJournal failed: ${res.status}`);
    return (await res.json()) as JournalGrid;
}

// ──────────────────────────────────────────────────────────────────────────────
// Columns
// ──────────────────────────────────────────────────────────────────────────────

export async function createColumn(payload: CreateColumnPayload): Promise<JournalColumn> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/columns`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createColumn failed: ${res.status}`);
    return unwrapNested<JournalColumn>(await res.json(), 'column');
}

export async function updateColumn(id: string, payload: UpdateColumnPayload): Promise<JournalColumn> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/columns/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `updateColumn failed: ${res.status}`);
    return unwrapNested<JournalColumn>(await res.json(), 'column');
}

export async function reorderColumns(payload: ReorderColumnsPayload): Promise<void> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/columns/reorder`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `reorderColumns failed: ${res.status}`);
}

/** Manual columns only. */
export async function deleteColumn(id: string): Promise<void> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/columns/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return throwApiError(res, `deleteColumn failed: ${res.status}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Cells
// ──────────────────────────────────────────────────────────────────────────────

export async function updateCell(payload: UpdateCellPayload): Promise<UpdatedCell> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/cells`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `updateCell failed: ${res.status}`);
    return unwrapNested<UpdatedCell>(await res.json(), 'cell');
}

// ──────────────────────────────────────────────────────────────────────────────
// Edit log (history)
// ──────────────────────────────────────────────────────────────────────────────

export async function listCellHistory(query: ListCellHistoryQuery): Promise<CellHistoryListResponse> {
    const res = await fetchWithRefresh(`${RATING_JOURNAL_API_BASE}/cells/history${buildQuery(query as unknown as Record<string, unknown>)}`);
    if (!res.ok) return throwApiError(res, `listCellHistory failed: ${res.status}`);
    return (await res.json()) as CellHistoryListResponse;
}
