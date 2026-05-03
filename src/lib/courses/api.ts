import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    Chapter,
    ChapterItem,
    ChangeTeacherPayload,
    CourseDetail,
    CourseListResponse,
    CreateCoursePayload,
    ListCoursesQuery,
    ReorderPayload,
    ScheduleListResponse,
    ScheduleRow,
    ScheduleUpsertPayload,
    UpdateCoursePayload,
    UploadFileResult,
    UploadTokenRequest,
    UploadTokenResponse,
    UpsertChapterPayload,
    UpsertItemPayload,
} from './types';

/**
 * Typed wrappers around the admin-api Courses endpoints (Phase 5 Plan 01 — skeleton).
 *
 * All courses endpoints route through the BFF proxy `/api/proxy/v1/admin/courses/*` —
 * the browser NEVER attaches a Bearer token directly to admin-api (CLAUDE.md
 * "Bypassing the BFF proxy" forbidden). Auth + cookie management happens in the
 * BFF Route Handler.
 *
 * EXCEPTION — `uploadFile` is the BFF-bypass path (CONTEXT D-13):
 *   Step 1 (`requestUploadToken`): goes through BFF as normal — admin-api signs
 *     a 5-minute JWT scoped to actor.id + size + content_type and returns
 *     `{ upload_url, token, expires_at, ... }`.
 *   Step 2 (`uploadFile`): the BROWSER hits `upload_url` (admin-api host) DIRECTLY
 *     with `X-Upload-Token: <token>` as the credential — NOT the admin Bearer
 *     cookie. This is the only sanctioned bypass. nginx must serve admin-api on
 *     the same origin as the admin-client OR CORS must allow the admin host.
 *
 * Plans 02-07 land the actual implementations behind these wrappers; Plan 01
 * only fences the function signatures + path constants so callers can import
 * them today.
 */

export const COURSES_API_BASE = '/api/proxy/v1/admin/courses';
export const UPLOADS_API_BASE = '/api/proxy/v1/admin/uploads';

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
// Courses CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listCourses(query?: ListCoursesQuery): Promise<CourseListResponse> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}${buildQuery(query as Record<string, unknown> | undefined)}`);
    if (!res.ok) throw new Error(`listCourses failed: ${res.status}`);
    return res.json();
}

export async function getCourse(id: number): Promise<CourseDetail> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}/${encodeURIComponent(String(id))}`);
    if (!res.ok) throw new Error(`getCourse failed: ${res.status}`);
    const json = await res.json();
    return unwrapData<CourseDetail>(json);
}

export async function createCourse(payload: CreateCoursePayload): Promise<CourseDetail> {
    const res = await fetchWithRefresh(COURSES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `createCourse failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CourseDetail>(json);
}

export async function updateCourse(id: number, payload: UpdateCoursePayload): Promise<CourseDetail> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `updateCourse failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CourseDetail>(json);
}

export async function deleteCourse(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteCourse failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

export async function changeCourseTeacher(id: number, payload: ChangeTeacherPayload): Promise<CourseDetail> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}/${encodeURIComponent(String(id))}/teacher`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `changeCourseTeacher failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CourseDetail>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Reorder (chapters + items, single $transaction on the server — Plan 05)
// ──────────────────────────────────────────────────────────────────────────────

export async function reorderCourse(id: number, payload: ReorderPayload): Promise<CourseDetail> {
    const res = await fetchWithRefresh(`${COURSES_API_BASE}/${encodeURIComponent(String(id))}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `reorderCourse failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<CourseDetail>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Chapters
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertChapter(courseId: number, payload: UpsertChapterPayload): Promise<Chapter> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/chapters/${encodeURIComponent(String(payload.id))}`
        : `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/chapters`;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertChapter failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<Chapter>(json);
}

export async function deleteChapter(courseId: number, chapterId: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(
        `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/chapters/${encodeURIComponent(String(chapterId))}`,
        { method: 'DELETE' },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteChapter failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Chapter items (file / quiz / assignment)
// ──────────────────────────────────────────────────────────────────────────────

export async function upsertItem(courseId: number, payload: UpsertItemPayload): Promise<ChapterItem> {
    const isUpdate = typeof payload.id === 'number';
    const url = isUpdate
        ? `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/items/${encodeURIComponent(String(payload.id))}`
        : `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/items`;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertItem failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<ChapterItem>(json);
}

export async function deleteItem(courseId: number, itemId: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(
        `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/items/${encodeURIComponent(String(itemId))}`,
        { method: 'DELETE' },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteItem failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: number; deleted: true }>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Schedules (per-group, item-level — schedule.id is BigInt → string)
// ──────────────────────────────────────────────────────────────────────────────

export async function listSchedules(
    courseId: number,
    query?: { group_id?: number },
): Promise<ScheduleListResponse> {
    const res = await fetchWithRefresh(
        `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/schedule${buildQuery(query as Record<string, unknown> | undefined)}`,
    );
    if (!res.ok) throw new Error(`listSchedules failed: ${res.status}`);
    return res.json();
}

export async function upsertSchedule(courseId: number, payload: ScheduleUpsertPayload): Promise<ScheduleRow> {
    const isUpdate = typeof payload.id === 'string' && payload.id.length > 0;
    const url = isUpdate
        ? `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/schedule/${encodeURIComponent(payload.id as string)}`
        : `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/schedule`;
    const res = await fetchWithRefresh(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `upsertSchedule failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<ScheduleRow>(json);
}

export async function deleteSchedule(
    courseId: number,
    scheduleId: string,
): Promise<{ id: string; deleted: true }> {
    const res = await fetchWithRefresh(
        `${COURSES_API_BASE}/${encodeURIComponent(String(courseId))}/schedule/${encodeURIComponent(scheduleId)}`,
        { method: 'DELETE' },
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, `deleteSchedule failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<{ id: string; deleted: true }>(json);
}

// ──────────────────────────────────────────────────────────────────────────────
// Uploads (BFF for token request; BFF-bypass for the binary upload itself)
// ──────────────────────────────────────────────────────────────────────────────

export async function requestUploadToken(payload: UploadTokenRequest): Promise<UploadTokenResponse> {
    const res = await fetchWithRefresh(`${UPLOADS_API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `requestUploadToken failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<UploadTokenResponse>(json);
}

/**
 * BFF-bypass binary upload (CONTEXT D-13).
 *
 * The browser hits `uploadUrl` (admin-api host) DIRECTLY using `X-Upload-Token`
 * as the credential. Do NOT use `fetchWithRefresh` here — the admin Bearer cookie
 * is irrelevant for this call; the upload token IS the credential, and a 401 from
 * the admin host should NOT trigger a refresh-token rotation.
 *
 * `onProgress` is exposed for future XHR-based progress reporting; the current
 * skeleton uses `fetch` (no progress events). Plan 04 may switch to XMLHttpRequest
 * if a real progress UI is needed.
 */
export async function uploadFile(
    uploadUrl: string,
    token: string,
    file: File,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onProgress?: (p: number) => void,
): Promise<UploadFileResult> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'X-Upload-Token': token },
        body: fd,
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, `uploadFile failed: ${res.status}`));
    const json = await res.json();
    return unwrapData<UploadFileResult>(json);
}
