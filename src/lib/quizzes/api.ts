import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CategoryCascadeBlocked,
    CategoryDeleteResult,
    CreateQuiz,
    ListQuizzesQuery,
    ListResultsQuery,
    QuizBadge,
    QuizBadgeItem,
    QuizCategory,
    QuizDetail,
    QuizListResponse,
    QuizResultsListResponse,
    ReorderBadgeItemsEntry,
    ReorderQuestions,
    UpdateQuiz,
    UpsertAnswer,
    UpsertBadge,
    UpsertBadgeItem,
    UpsertCategory,
    UpsertQuestion,
} from './types';

/**
 * Typed wrappers around the admin-api Quizzes endpoints (Phase 6 Plan 01 — skeletons).
 *
 * All quiz endpoints route through the BFF proxy `/api/proxy/v1/admin/quizzes/*`,
 * `/api/proxy/v1/admin/quiz-categories/*`, and `/api/proxy/v1/admin/quiz-badges/*`.
 * The browser never attaches a Bearer token directly to admin-api (CLAUDE.md
 * "Bypassing the BFF proxy" forbidden). Auth + cookie management happens in the
 * BFF Route Handler.
 *
 * Wrappers are FULLY IMPLEMENTED here (real fetchWithRefresh calls), but the
 * downstream admin-api endpoints don't exist yet — they land in:
 *   - listQuizzes / getQuiz / createQuiz / updateQuiz / deleteQuiz / duplicateQuiz → Plan 02 + Plan 04
 *   - upsertQuestion / deleteQuestion / upsertAnswer / deleteAnswer / reorderQuestions → Plan 05
 *   - listCategories / upsertCategory / deleteCategory → Plan 03
 *   - listBadges / upsertBadge / deleteBadge / addBadgeItem / removeBadgeItem / reorderBadgeItems → Plan 06
 *   - listResults → Plan 07
 *
 * Calling a wrapper before its endpoint lands returns a real 404 from admin-api.
 * The wrappers do NOT throw at IMPORT time — they only fail when invoked.
 */

export const QUIZZES_API_BASE = '/api/proxy/v1/admin/quizzes';
export const QUIZ_CATEGORIES_API_BASE = '/api/proxy/v1/admin/quiz-categories';
export const QUIZ_BADGES_API_BASE = '/api/proxy/v1/admin/quiz-badges';
export const QUIZ_RESULTS_API_BASE = '/api/proxy/v1/admin/quiz-results';

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
// Quizzes CRUD (Plan 02 + Plan 04)
// ──────────────────────────────────────────────────────────────────────────────

export async function listQuizzes(query?: ListQuizzesQuery): Promise<QuizListResponse> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listQuizzes failed: ${res.status}`);
    return res.json();
}

export async function getQuiz(id: number): Promise<QuizDetail> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getQuiz failed: ${res.status}`);
    const json = await res.json();
    return unwrapData<QuizDetail>(json);
}

export async function createQuiz(payload: CreateQuiz): Promise<QuizDetail> {
    const res = await fetchWithRefresh(QUIZZES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createQuiz failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizDetail>(json);
}

export async function updateQuiz(id: number, payload: UpdateQuiz): Promise<QuizDetail> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateQuiz failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizDetail>(json);
}

export async function deleteQuiz(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteQuiz failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function duplicateQuiz(id: number): Promise<QuizDetail> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(id))}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `duplicateQuiz failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizDetail>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Questions / Answers (Plan 05)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Typed error thrown by question/answer mutations when the server returns 409
 * with `status='quizzes.force_confirm_required'`. The dialog flow re-submits
 * the SAME payload with `force_confirm_token` populated.
 *
 * The token's edit_intent_hash binds it to the exact retry payload — any drift
 * between the original DTO and the retry produces a different hash and rejects
 * with 401 'force_confirm.payload_changed'. Callers MUST therefore retry with
 * the EXACT same payload (only adding force_confirm_token).
 */
export class ForceConfirmRequiredError extends Error {
    public readonly open_attempts_count: number;
    public readonly force_confirm_token: string;
    public readonly expires_at: number;
    public readonly status = 'quizzes.force_confirm_required' as const;

    constructor(body: { open_attempts_count: number; force_confirm_token: string; expires_at: number }) {
        super('quizzes.force_confirm_required');
        this.name = 'ForceConfirmRequiredError';
        this.open_attempts_count = body.open_attempts_count;
        this.force_confirm_token = body.force_confirm_token;
        this.expires_at = body.expires_at;
    }
}

/**
 * Parse a 409 response and throw ForceConfirmRequiredError if it carries the
 * destructive-edit envelope. Nest's default exception filter wraps a thrown
 * ConflictException's body under `response.message` when the body is an object.
 * Tolerate both shapes.
 */
async function maybeThrowForceConfirm(res: Response): Promise<void> {
    if (res.status !== 409) return;
    const body = (await res.clone().json().catch(() => ({}))) as Record<string, unknown>;
    const inner =
        body && typeof body === 'object' && body.message && typeof body.message === 'object'
            ? (body.message as Record<string, unknown>)
            : body;
    const status = String(inner.status ?? body.status ?? '');
    if (status === 'quizzes.force_confirm_required') {
        throw new ForceConfirmRequiredError({
            open_attempts_count: Number(inner.open_attempts_count ?? body.open_attempts_count ?? 0),
            force_confirm_token: String(inner.force_confirm_token ?? body.force_confirm_token ?? ''),
            expires_at: Number(inner.expires_at ?? body.expires_at ?? 0),
        });
    }
}

export async function listQuestions(quizId: number): Promise<{
    rows: import('./types').QuestionDetail[];
    version: number;
}> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `listQuestions failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ rows: import('./types').QuestionDetail[]; version: number }>(json);
}

export async function upsertQuestion(
    quizId: number,
    payload: UpsertQuestion,
): Promise<{ question: import('./types').QuestionDetail; version: number }> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/${encodeURIComponent(String(payload.id))}`
        : `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions`;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await maybeThrowForceConfirm(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertQuestion failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ question: import('./types').QuestionDetail; version: number }>(json);
}

export async function deleteQuestion(
    quizId: number,
    questionId: number,
    force_confirm_token?: string,
): Promise<{ id: number; version: number }> {
    const qs = force_confirm_token ? `?force_confirm_token=${encodeURIComponent(force_confirm_token)}` : '';
    const res = await fetchWithRefresh(
        `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/${encodeURIComponent(String(questionId))}${qs}`,
        { method: 'DELETE' },
    );
    await maybeThrowForceConfirm(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteQuestion failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; version: number }>(json);
}

export async function upsertAnswer(
    quizId: number,
    questionId: number,
    payload: UpsertAnswer,
): Promise<{ answer: import('./types').AnswerDetail; version: number }> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/${encodeURIComponent(String(questionId))}/answers/${encodeURIComponent(String(payload.id))}`
        : `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/${encodeURIComponent(String(questionId))}/answers`;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await maybeThrowForceConfirm(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertAnswer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ answer: import('./types').AnswerDetail; version: number }>(json);
}

export async function deleteAnswer(
    quizId: number,
    questionId: number,
    answerId: number,
    force_confirm_token?: string,
): Promise<{ id: number; version: number }> {
    const qs = force_confirm_token ? `?force_confirm_token=${encodeURIComponent(force_confirm_token)}` : '';
    const res = await fetchWithRefresh(
        `${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/${encodeURIComponent(String(questionId))}/answers/${encodeURIComponent(String(answerId))}${qs}`,
        { method: 'DELETE' },
    );
    await maybeThrowForceConfirm(res);
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteAnswer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; version: number }>(json);
}

export async function reorderQuestions(
    quizId: number,
    items: ReorderQuestions['items'],
): Promise<{ items: Array<{ id: number; order: number }> }> {
    const res = await fetchWithRefresh(`${QUIZZES_API_BASE}/${encodeURIComponent(String(quizId))}/questions/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `reorderQuestions failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ items: Array<{ id: number; order: number }> }>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Categories (Plan 03)
// ──────────────────────────────────────────────────────────────────────────────

export async function listCategories(): Promise<QuizCategory[]> {
    const res = await fetchWithRefresh(QUIZ_CATEGORIES_API_BASE);
    if (!res.ok) throw new Error(`listCategories failed: ${res.status}`);
    const json = await res.json();
    // Some endpoints wrap in {data}; tolerate both list-shape and unwrapped envelope.
    if (Array.isArray(json)) return json as QuizCategory[];
    if (json && typeof json === 'object' && Array.isArray((json as { rows?: unknown }).rows)) {
        return (json as { rows: QuizCategory[] }).rows;
    }
    const inner = unwrapData<unknown>(json);
    if (Array.isArray(inner)) return inner as QuizCategory[];
    if (inner && typeof inner === 'object' && Array.isArray((inner as { rows?: unknown }).rows)) {
        return (inner as { rows: QuizCategory[] }).rows;
    }
    return [];
}

export async function upsertCategory(payload: UpsertCategory): Promise<QuizCategory> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${QUIZ_CATEGORIES_API_BASE}/${encodeURIComponent(String(payload.id))}`
        : QUIZ_CATEGORIES_API_BASE;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizCategory>(json);
}

/**
 * Typed error thrown by `deleteCategory` on 409 cascade-blocked responses.
 * Allows the cascade-warning Dialog to display real quiz_count + child_count
 * before the admin opts into ?force=true.
 */
export class CategoryCascadeBlockedError extends Error {
    public readonly quiz_count: number;
    public readonly child_count: number;
    public readonly status = 'quiz_categories.cascade_blocked' as const;

    constructor(body: CategoryCascadeBlocked) {
        super(body.message ?? 'quiz_categories.cascade_blocked');
        this.name = 'CategoryCascadeBlockedError';
        this.quiz_count = body.quiz_count;
        this.child_count = body.child_count;
    }
}

export async function deleteCategory(id: number, force?: boolean): Promise<CategoryDeleteResult> {
    const qs = force ? '?force=true' : '';
    const res = await fetchWithRefresh(`${QUIZ_CATEGORIES_API_BASE}/${encodeURIComponent(String(id))}${qs}`, {
        method: 'DELETE',
    });
    if (res.status === 409) {
        // Nest's default exception filter wraps thrown ConflictException's body
        // under `response.message` when constructed with an object (it places the
        // entire object at `response`). We tolerate both shapes.
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const inner =
            body && typeof body === 'object' && body.message && typeof body.message === 'object'
                ? (body.message as Record<string, unknown>)
                : body;
        const status = String(inner.status ?? body.status ?? 'quiz_categories.cascade_blocked');
        if (status === 'quiz_categories.cascade_blocked') {
            throw new CategoryCascadeBlockedError({
                status: 'quiz_categories.cascade_blocked',
                message: String(inner.message ?? body.message ?? 'cascade_blocked'),
                quiz_count: Number(inner.quiz_count ?? 0),
                child_count: Number(inner.child_count ?? 0),
            });
        }
    }
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteCategory failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CategoryDeleteResult>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Badges + Badge Items (Plan 06)
// ──────────────────────────────────────────────────────────────────────────────

export async function listBadges(): Promise<QuizBadge[]> {
    const res = await fetchWithRefresh(QUIZ_BADGES_API_BASE);
    if (!res.ok) throw new Error(`listBadges failed: ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json)) return json as QuizBadge[];
    if (json && typeof json === 'object' && Array.isArray((json as { rows?: unknown }).rows)) {
        return (json as { rows: QuizBadge[] }).rows;
    }
    return unwrapData<QuizBadge[]>(json);
}

export async function upsertBadge(payload: UpsertBadge): Promise<QuizBadge> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${QUIZ_BADGES_API_BASE}/${encodeURIComponent(String(payload.id))}`
        : QUIZ_BADGES_API_BASE;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertBadge failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizBadge>(json);
}

export async function deleteBadge(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${QUIZ_BADGES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteBadge failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function addBadgeItem(payload: UpsertBadgeItem): Promise<QuizBadgeItem> {
    const res = await fetchWithRefresh(
        `${QUIZ_BADGES_API_BASE}/${encodeURIComponent(String(payload.quiz_badge_id))}/items`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `addBadgeItem failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<QuizBadgeItem>(json);
}

export async function removeBadgeItem(badgeId: number, itemId: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(
        `${QUIZ_BADGES_API_BASE}/${encodeURIComponent(String(badgeId))}/items/${encodeURIComponent(String(itemId))}`,
        { method: 'DELETE' },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `removeBadgeItem failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function reorderBadgeItems(badgeId: number, items: ReorderBadgeItemsEntry[]): Promise<void> {
    const res = await fetchWithRefresh(
        `${QUIZ_BADGES_API_BASE}/${encodeURIComponent(String(badgeId))}/items/reorder`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
        },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `reorderBadgeItems failed: ${res.status}`));
}

// ──────────────────────────────────────────────────────────────────────────────
// Results (Plan 07)
// ──────────────────────────────────────────────────────────────────────────────

export async function listResults(query?: ListResultsQuery): Promise<QuizResultsListResponse> {
    const res = await fetchWithRefresh(`${QUIZ_RESULTS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listResults failed: ${res.status}`);
    return res.json();
}
