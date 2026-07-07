import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CreateCreditLaunchPayload,
    CreateCreditPayload,
    CreateCreditQuestionPayload,
    CreateCreditTopicPayload,
    CreditCalendarEntry,
    CreditDetail,
    CreditEligibleStudent,
    CreditHistoryListResponse,
    CreditLaunchDetail,
    CreditLaunchListResponse,
    CreditListResponse,
    CreditQuestionDeficit,
    CreditQuestionListResponse,
    CreditQuestionRow,
    CreditQuestionMark,
    CreditResultTextRange,
    CreditSessionDetail,
    CreditTopic,
    CreditTopicAvailability,
    ListCreditHistoryQuery,
    ListCreditLaunchesQuery,
    ListCreditQuestionsQuery,
    ListCreditsQuery,
    UpdateCreditPayload,
    UpdateCreditQuestionPayload,
    UpdateCreditTopicPayload,
} from './types';

/**
 * Typed wrappers around the admin-api Credits endpoints (Phase 34).
 *
 * All calls route through the BFF proxy — the browser never attaches a Bearer
 * token to admin-api directly (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 *
 * Error contract (CREDITS_CONTRACT.md):
 *   - 422 `credits.question_deficit` → NotEnoughQuestionsError with the
 *     per-(topic × difficulty) `deficits` array (launch wizard renders them).
 *   - Any other non-2xx carrying a `credits.*` code (409/422 conflicts like
 *     `credits.active_sessions`, `credits.active_session_exists`,
 *     `credits.session_expired`, `credits.session_finished`,
 *     `credits.already_passed`, `credits.invalid_students`,
 *     `credits.pass_value_exceeds_max`) → CreditApiError carrying `code`.
 *   - Nest wraps exception bodies either flat or under `response.message` —
 *     both shapes are tolerated (mirrors lib/quizzes/api.ts).
 */

export const CREDITS_API_BASE = '/api/proxy/v1/admin/credits';
export const CREDIT_TOPICS_API_BASE = '/api/proxy/v1/admin/credit-topics';
export const CREDIT_QUESTIONS_API_BASE = '/api/proxy/v1/admin/credit-questions';
export const CREDIT_SESSIONS_API_BASE = '/api/proxy/v1/admin/credit-sessions';
export const CREDIT_SETTINGS_API_BASE = '/api/proxy/v1/admin/credit-settings';

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

// ──────────────────────────────────────────────────────────────────────────────
// Typed errors
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generic admin-api error for the credits domain. `code` is the machine code
 * from the response body (`credits.*`) or '' when the body carried none.
 */
export class CreditApiError extends Error {
    public readonly code: string;
    public readonly httpStatus: number;
    public readonly details: Record<string, unknown>;

    constructor(code: string, httpStatus: number, message: string, details: Record<string, unknown> = {}) {
        super(message);
        this.name = 'CreditApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
    }
}

/**
 * 422 `credits.question_deficit` — the launch wizard's selected topics don't
 * have enough active questions for the current difficulty template.
 */
export class NotEnoughQuestionsError extends Error {
    public readonly code = 'credits.question_deficit' as const;
    public readonly deficits: CreditQuestionDeficit[];

    constructor(deficits: CreditQuestionDeficit[], message?: string) {
        super(message ?? 'credits.question_deficit');
        this.name = 'NotEnoughQuestionsError';
        this.deficits = deficits;
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
    // `code` first: credits endpoints put the machine code in `code` and may reuse
    // `status` for a session-status string (e.g. { code: 'credits.session_finished',
    // status: 'finished' }) — status-first parsing would swallow the code.
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
    return { code: code.includes('.') || code.startsWith('credits') ? code : '', message, inner };
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
    const parsed = await parseErrorBody(res);
    if (parsed.code === 'credits.question_deficit') {
        const raw = parsed.inner.deficits;
        const deficits = Array.isArray(raw) ? (raw as CreditQuestionDeficit[]) : [];
        throw new NotEnoughQuestionsError(deficits, parsed.message || fallback);
    }
    throw new CreditApiError(parsed.code, res.status, parsed.message || fallback, parsed.inner);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

// ──────────────────────────────────────────────────────────────────────────────
// Credits CRUD / list / detail / history / calendar / eligible students
// ──────────────────────────────────────────────────────────────────────────────

export async function listCredits(query?: ListCreditsQuery): Promise<CreditListResponse> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) return throwApiError(res, `listCredits failed: ${res.status}`);
    return (await res.json()) as CreditListResponse;
}

export async function getCreditsCalendar(args: { from: number; to: number }): Promise<CreditCalendarEntry[]> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/calendar${buildQuery(args)}`);
    if (!res.ok) return throwApiError(res, `getCreditsCalendar failed: ${res.status}`);
    const data = unwrapData<{ credits: CreditCalendarEntry[] }>(await res.json());
    return data?.credits ?? [];
}

export async function getCredit(id: string): Promise<CreditDetail> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(id)}`);
    if (!res.ok) return throwApiError(res, `getCredit failed: ${res.status}`);
    return unwrapData<CreditDetail>(await res.json());
}

export async function createCredit(payload: CreateCreditPayload): Promise<CreditDetail> {
    const res = await fetchWithRefresh(CREDITS_API_BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createCredit failed: ${res.status}`);
    return unwrapData<CreditDetail>(await res.json());
}

export async function updateCredit(id: string, payload: UpdateCreditPayload): Promise<CreditDetail> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `updateCredit failed: ${res.status}`);
    return unwrapData<CreditDetail>(await res.json());
}

/** Soft delete. 409 `credits.active_sessions` when pending/in_progress sessions exist. */
export async function deleteCredit(id: string): Promise<{ id: string; deleted: true }> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return throwApiError(res, `deleteCredit failed: ${res.status}`);
    return unwrapData<{ id: string; deleted: true }>(await res.json());
}

export async function listCreditHistory(id: string, query?: ListCreditHistoryQuery): Promise<CreditHistoryListResponse> {
    const res = await fetchWithRefresh(
        `${CREDITS_API_BASE}/${encodeURIComponent(id)}/history${buildQuery(query as Record<string, unknown> | undefined)}`
    );
    if (!res.ok) return throwApiError(res, `listCreditHistory failed: ${res.status}`);
    return (await res.json()) as CreditHistoryListResponse;
}

export async function listEligibleStudents(id: string): Promise<CreditEligibleStudent[]> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(id)}/eligible-students`);
    if (!res.ok) return throwApiError(res, `listEligibleStudents failed: ${res.status}`);
    const data = unwrapData<{ students: CreditEligibleStudent[] }>(await res.json());
    return data?.students ?? [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Topics
// ──────────────────────────────────────────────────────────────────────────────

export async function listCreditTopics(includeArchived?: boolean): Promise<CreditTopic[]> {
    const res = await fetchWithRefresh(`${CREDIT_TOPICS_API_BASE}${buildQuery(includeArchived ? { include_archived: 1 } : undefined)}`);
    if (!res.ok) return throwApiError(res, `listCreditTopics failed: ${res.status}`);
    const data = unwrapData<{ topics: CreditTopic[] } | CreditTopic[]>(await res.json());
    if (Array.isArray(data)) return data;
    return data?.topics ?? [];
}

export async function createCreditTopic(payload: CreateCreditTopicPayload): Promise<CreditTopic> {
    const res = await fetchWithRefresh(CREDIT_TOPICS_API_BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createCreditTopic failed: ${res.status}`);
    return unwrapNested<CreditTopic>(await res.json(), 'topic');
}

export async function updateCreditTopic(id: string, payload: UpdateCreditTopicPayload): Promise<CreditTopic> {
    const res = await fetchWithRefresh(`${CREDIT_TOPICS_API_BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `updateCreditTopic failed: ${res.status}`);
    return unwrapNested<CreditTopic>(await res.json(), 'topic');
}

/** 409 (FK RESTRICT) when the topic still has children or questions. */
export async function deleteCreditTopic(id: string): Promise<{ id: string; deleted: true }> {
    const res = await fetchWithRefresh(`${CREDIT_TOPICS_API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return throwApiError(res, `deleteCreditTopic failed: ${res.status}`);
    return unwrapData<{ id: string; deleted: true }>(await res.json());
}

// ──────────────────────────────────────────────────────────────────────────────
// Question bank
// ──────────────────────────────────────────────────────────────────────────────

export async function listCreditQuestions(query?: ListCreditQuestionsQuery): Promise<CreditQuestionListResponse> {
    const res = await fetchWithRefresh(`${CREDIT_QUESTIONS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) return throwApiError(res, `listCreditQuestions failed: ${res.status}`);
    return (await res.json()) as CreditQuestionListResponse;
}

/** Active-question counts per (topic × difficulty) for the wizard availability panel. */
export async function getCreditQuestionAvailability(topicIds: string[]): Promise<CreditTopicAvailability[]> {
    const res = await fetchWithRefresh(`${CREDIT_QUESTIONS_API_BASE}/availability${buildQuery({ topic_ids: topicIds.join(',') })}`);
    if (!res.ok) return throwApiError(res, `getCreditQuestionAvailability failed: ${res.status}`);
    const data = unwrapData<{ availability: CreditTopicAvailability[] }>(await res.json());
    return data?.availability ?? [];
}

export async function createCreditQuestion(payload: CreateCreditQuestionPayload): Promise<CreditQuestionRow> {
    const res = await fetchWithRefresh(CREDIT_QUESTIONS_API_BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createCreditQuestion failed: ${res.status}`);
    return unwrapNested<CreditQuestionRow>(await res.json(), 'question');
}

export async function updateCreditQuestion(id: string, payload: UpdateCreditQuestionPayload): Promise<CreditQuestionRow> {
    const res = await fetchWithRefresh(`${CREDIT_QUESTIONS_API_BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `updateCreditQuestion failed: ${res.status}`);
    return unwrapNested<CreditQuestionRow>(await res.json(), 'question');
}

/** Admin-only on the server (@Roles('admin')). */
export async function deleteCreditQuestion(id: string): Promise<{ id: string; deleted: true }> {
    const res = await fetchWithRefresh(`${CREDIT_QUESTIONS_API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return throwApiError(res, `deleteCreditQuestion failed: ${res.status}`);
    return unwrapData<{ id: string; deleted: true }>(await res.json());
}

// ──────────────────────────────────────────────────────────────────────────────
// Launches
// ──────────────────────────────────────────────────────────────────────────────

function unwrapLaunch(json: unknown): CreditLaunchDetail {
    return unwrapNested<CreditLaunchDetail>(json, 'launch');
}

/** Unwrap apiResponse `data`, then an optional single-key nesting ({topic}/{question}/{launch}…). */
function unwrapNested<T>(json: unknown, key: string): T {
    const data = unwrapData<Record<string, unknown>>(json);
    if (data && typeof data === 'object' && key in data && data[key]) {
        return data[key] as T;
    }
    return data as unknown as T;
}

/**
 * Throws NotEnoughQuestionsError on 422 `credits.question_deficit`;
 * CreditApiError with the code string on the other launch conflicts
 * (`credits.invalid_students`, `credits.already_passed`,
 * `credits.active_session_exists`, `credits.pass_value_exceeds_max`).
 */
export async function createCreditLaunch(creditId: string, payload: CreateCreditLaunchPayload): Promise<CreditLaunchDetail> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(creditId)}/launches`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    if (!res.ok) return throwApiError(res, `createCreditLaunch failed: ${res.status}`);
    return unwrapLaunch(await res.json());
}

export async function getCreditLaunch(creditId: string, launchId: string): Promise<CreditLaunchDetail> {
    const res = await fetchWithRefresh(`${CREDITS_API_BASE}/${encodeURIComponent(creditId)}/launches/${encodeURIComponent(launchId)}`);
    if (!res.ok) return throwApiError(res, `getCreditLaunch failed: ${res.status}`);
    return unwrapLaunch(await res.json());
}

export async function listCreditLaunches(creditId: string, query?: ListCreditLaunchesQuery): Promise<CreditLaunchListResponse> {
    const res = await fetchWithRefresh(
        `${CREDITS_API_BASE}/${encodeURIComponent(creditId)}/launches${buildQuery(query as Record<string, unknown> | undefined)}`
    );
    if (!res.ok) return throwApiError(res, `listCreditLaunches failed: ${res.status}`);
    return (await res.json()) as CreditLaunchListResponse;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conduct (sessions). Mutations return the FULL fresh session detail so the
// console can setQueryData without a refetch (contract decision).
// ──────────────────────────────────────────────────────────────────────────────

function unwrapSession(json: unknown): CreditSessionDetail {
    const data = unwrapData<Record<string, unknown>>(json);
    if (data && typeof data === 'object' && 'session' in data && data.session) {
        return data.session as unknown as CreditSessionDetail;
    }
    return data as unknown as CreditSessionDetail;
}

export async function getCreditSession(id: string): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}`);
    if (!res.ok) return throwApiError(res, `getCreditSession failed: ${res.status}`);
    return unwrapSession(await res.json());
}

/** 409 `credits.active_session_exists` when another session of the launch is in_progress. */
export async function startCreditSession(id: string): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/start`, {
        method: 'POST',
        headers: JSON_HEADERS,
    });
    if (!res.ok) return throwApiError(res, `startCreditSession failed: ${res.status}`);
    return unwrapSession(await res.json());
}

export async function setCreditSessionCurrent(id: string, position: number): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/current`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ position }),
    });
    if (!res.ok) return throwApiError(res, `setCreditSessionCurrent failed: ${res.status}`);
    return unwrapSession(await res.json());
}

/** Marks are mutable until finalize. 409 `credits.session_expired` past the ends_at grace. */
export async function markCreditSessionQuestion(
    id: string,
    position: number,
    mark: Exclude<CreditQuestionMark, 'pending'>
): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(
        `${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/questions/${encodeURIComponent(String(position))}/mark`,
        {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ mark }),
        }
    );
    if (!res.ok) return throwApiError(res, `markCreditSessionQuestion failed: ${res.status}`);
    return unwrapSession(await res.json());
}

export async function finishCreditSession(id: string): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/finish`, {
        method: 'POST',
        headers: JSON_HEADERS,
    });
    if (!res.ok) return throwApiError(res, `finishCreditSession failed: ${res.status}`);
    return unwrapSession(await res.json());
}

export async function cancelCreditSession(id: string): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        headers: JSON_HEADERS,
    });
    if (!res.ok) return throwApiError(res, `cancelCreditSession failed: ${res.status}`);
    return unwrapSession(await res.json());
}

/** Only on finalized non-passed sessions. `retakeAt` is unix seconds. */
export async function scheduleCreditSessionRetake(id: string, retakeAt: number): Promise<CreditSessionDetail> {
    const res = await fetchWithRefresh(`${CREDIT_SESSIONS_API_BASE}/${encodeURIComponent(id)}/schedule-retake`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ retake_at: retakeAt }),
    });
    if (!res.ok) return throwApiError(res, `scheduleCreditSessionRetake failed: ${res.status}`);
    return unwrapSession(await res.json());
}

// ──────────────────────────────────────────────────────────────────────────────
// Result texts (credit-settings)
// ──────────────────────────────────────────────────────────────────────────────

export async function getCreditResultTexts(): Promise<CreditResultTextRange[]> {
    const res = await fetchWithRefresh(`${CREDIT_SETTINGS_API_BASE}/result-texts`);
    if (!res.ok) return throwApiError(res, `getCreditResultTexts failed: ${res.status}`);
    const data = unwrapData<{ ranges: CreditResultTextRange[] } | CreditResultTextRange[]>(await res.json());
    if (Array.isArray(data)) return data;
    return data?.ranges ?? [];
}

export async function updateCreditResultTexts(ranges: CreditResultTextRange[]): Promise<CreditResultTextRange[]> {
    const res = await fetchWithRefresh(`${CREDIT_SETTINGS_API_BASE}/result-texts`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ranges }),
    });
    if (!res.ok) return throwApiError(res, `updateCreditResultTexts failed: ${res.status}`);
    const data = unwrapData<{ ranges: CreditResultTextRange[] } | CreditResultTextRange[]>(await res.json());
    if (Array.isArray(data)) return data;
    return data?.ranges ?? ranges;
}
