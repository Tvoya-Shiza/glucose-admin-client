import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    CreateTrainer,
    DeleteTrainerResult,
    ExportTrainerResults,
    ListTrainerResultsQuery,
    ListTrainersQuery,
    PublishTrainer,
    PublishTrainerResult,
    TrainerDetail,
    TrainerListResponse,
    TrainerPublishBlocked,
    TrainerResultsListResponse,
    TrainerResultsStatsResponse,
    UpdateTrainer,
} from './types';

/**
 * Typed wrappers around the admin-api «Тренажёр» endpoints (Phase 38).
 *
 * Structure mirrors src/lib/quizzes/api.ts verbatim: everything routes through the
 * BFF proxy under `/api/proxy/v1/admin/trainers/*` and `/api/proxy/v1/admin/
 * trainer-results/*`. The browser NEVER attaches a Bearer token to admin-api
 * directly (CLAUDE.md "Bypassing the BFF proxy" forbidden) — the proxy Route
 * Handler injects it server-side.
 *
 * Response envelope contract (from admin-api CLAUDE.md):
 *   - LIST endpoints (trainers list, results list, results stats) return their
 *     raw shape ({ rows, total, pageCount } / stats object) — consumed directly.
 *   - SINGLE-resource + mutation endpoints wrap with apiResponse({ data }) — the
 *     private `unwrapData` helper peels the envelope.
 *
 * Questions/answers are intentionally ABSENT here — a trainer's id IS a quizzes
 * row, so the existing `/api/proxy/v1/admin/quizzes/:quizId/questions*` surface
 * (src/lib/quizzes/api.ts) serves trainers unchanged.
 */

export const TRAINERS_API_BASE = '/api/proxy/v1/admin/trainers';
export const TRAINER_RESULTS_API_BASE = '/api/proxy/v1/admin/trainer-results';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
// Trainers CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listTrainers(query?: ListTrainersQuery): Promise<TrainerListResponse> {
    const res = await fetchWithRefresh(`${TRAINERS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listTrainers failed: ${res.status}`);
    return res.json();
}

export async function getTrainer(id: number): Promise<TrainerDetail> {
    const res = await fetchWithRefresh(`${TRAINERS_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getTrainer failed: ${res.status}`);
    const json = await res.json();
    return unwrapData<TrainerDetail>(json);
}

export async function createTrainer(payload: CreateTrainer): Promise<TrainerDetail> {
    const res = await fetchWithRefresh(TRAINERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createTrainer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<TrainerDetail>(json);
}

export async function updateTrainer(id: number, payload: UpdateTrainer): Promise<TrainerDetail> {
    const res = await fetchWithRefresh(`${TRAINERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateTrainer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<TrainerDetail>(json);
}

export async function deleteTrainer(id: number): Promise<DeleteTrainerResult> {
    const res = await fetchWithRefresh(`${TRAINERS_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteTrainer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<DeleteTrainerResult>(json);
}

/**
 * Typed error thrown by `publishTrainer` when the server refuses to publish
 * ('public') because the trainer has zero runnable (single/multiple) questions
 * or zero linked courses. Carries the counts so the toast can explain the reason.
 *
 * Nest's default exception filter wraps a ConflictException constructed with an
 * object under `response.message` when that body is an object; we tolerate both
 * the nested and the flat shape (same posture as ForceConfirmRequiredError).
 */
export class TrainerPublishBlockedError extends Error {
    public readonly question_count: number;
    public readonly course_count: number;
    public readonly status = 'trainers.publish_blocked' as const;

    constructor(body: TrainerPublishBlocked) {
        super(body.message ?? 'trainers.publish_blocked');
        this.name = 'TrainerPublishBlockedError';
        this.question_count = body.question_count;
        this.course_count = body.course_count;
    }
}

export async function publishTrainer(id: number, payload: PublishTrainer): Promise<PublishTrainerResult> {
    const res = await fetchWithRefresh(`${TRAINERS_API_BASE}/${encodeURIComponent(String(id))}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (res.status === 409) {
        const body = (await res
            .clone()
            .json()
            .catch(() => ({}))) as Record<string, unknown>;
        const inner =
            body && typeof body === 'object' && body.message && typeof body.message === 'object'
                ? (body.message as Record<string, unknown>)
                : body;
        const status = String(inner.status ?? body.status ?? '');
        if (status === 'trainers.publish_blocked') {
            throw new TrainerPublishBlockedError({
                status: 'trainers.publish_blocked',
                message: String(inner.message ?? body.message ?? 'trainers.publish_blocked'),
                question_count: Number(inner.question_count ?? body.question_count ?? 0),
                course_count: Number(inner.course_count ?? body.course_count ?? 0),
            });
        }
    }
    if (!res.ok) throw new Error(await readErrorMessage(res, `publishTrainer failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<PublishTrainerResult>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Results (list + stats + export)
// ──────────────────────────────────────────────────────────────────────────────

export async function listTrainerResults(query?: ListTrainerResultsQuery): Promise<TrainerResultsListResponse> {
    const res = await fetchWithRefresh(`${TRAINER_RESULTS_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listTrainerResults failed: ${res.status}`);
    return res.json();
}

export async function getTrainerResultsStats(query?: ListTrainerResultsQuery): Promise<TrainerResultsStatsResponse> {
    const res = await fetchWithRefresh(`${TRAINER_RESULTS_API_BASE}/stats${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`getTrainerResultsStats failed: ${res.status}`);
    return res.json();
}

/**
 * POST /trainer-results/export → server-generated CSV/XLSX Blob, then trigger a
 * browser download. admin-api sets Content-Disposition and the BFF proxy forwards
 * it, but the download is driven client-side from the blob body with our own
 * filename so it works even if the proxy ever drops that header. Throttled at
 * admin-api (5 calls / 15 min / IP) — surface a 429 as a caught Error.
 */
export async function exportTrainerResults(payload: ExportTrainerResults): Promise<void> {
    const res = await fetchWithRefresh(`${TRAINER_RESULTS_API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `exportTrainerResults failed: ${res.status}`));
    const blob = await res.blob();
    const ts = Math.floor(Date.now() / 1000);
    triggerDownload(blob, `trainer-results-${ts}.${payload.format}`);
}

/** Trigger a browser download for a Blob (forces the XLSX MIME if the proxy dropped it). */
export function triggerDownload(blob: Blob, filename: string): void {
    const out = filename.endsWith('.xlsx') && !blob.type.includes('spreadsheetml') ? new Blob([blob], { type: XLSX_MIME }) : blob;
    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
