import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    AssignmentAnalytics,
    AssignmentAttachment,
    AssignmentDetail,
    AssignmentListResponse,
    CreateAssignmentPayload,
    GradeSubmissionPayload,
    ListAssignmentsQuery,
    ListSubmissionsQuery,
    SubmissionDetail,
    SubmissionListResponse,
    UpdateAssignmentPayload,
    UpsertAttachmentPayload,
} from './types';

/**
 * Typed wrappers around the admin-api Assignments endpoints.
 *
 * All routes go through the BFF proxy `/api/proxy/v1/admin/assignments/*` —
 * the browser never attaches a Bearer token directly to admin-api
 * (CLAUDE.md AUTH-08).
 */

export const ASSIGNMENTS_API_BASE = '/api/proxy/v1/admin/assignments';

function buildQuery(params: object): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        qs.set(k, String(v));
    }
    const s = qs.toString();
    return s.length === 0 ? '' : `?${s}`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`admin-api ${res.status}: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
}

export async function listAssignments(query: ListAssignmentsQuery = {}): Promise<AssignmentListResponse> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}${buildQuery(query)}`);
    return jsonOrThrow<AssignmentListResponse>(res);
}

export async function getAssignment(id: number): Promise<AssignmentDetail> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}`);
    return jsonOrThrow<AssignmentDetail>(res);
}

export async function getAssignmentsAnalytics(assignmentId?: number): Promise<AssignmentAnalytics> {
    const url = assignmentId == null
        ? `${ASSIGNMENTS_API_BASE}/analytics`
        : `${ASSIGNMENTS_API_BASE}/${assignmentId}/analytics`;
    const res = await fetchWithRefresh(url);
    return jsonOrThrow<AssignmentAnalytics>(res);
}

export async function createAssignment(payload: CreateAssignmentPayload): Promise<{ id: number }> {
    const res = await fetchWithRefresh(ASSIGNMENTS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return jsonOrThrow<{ id: number }>(res);
}

export async function updateAssignment(id: number, payload: UpdateAssignmentPayload): Promise<{ id: number }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return jsonOrThrow<{ id: number }>(res);
}

export async function toggleAssignmentStatus(id: number, status: 'active' | 'inactive'): Promise<{ id: number; status: 'active' | 'inactive' }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    return jsonOrThrow<{ id: number; status: 'active' | 'inactive' }>(res);
}

export async function deleteAssignment(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}`, { method: 'DELETE' });
    return jsonOrThrow<{ id: number; deleted: true }>(res);
}

export async function addAssignmentAttachment(id: number, payload: UpsertAttachmentPayload): Promise<AssignmentAttachment> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return jsonOrThrow<AssignmentAttachment>(res);
}

export async function removeAssignmentAttachment(id: number, attachId: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${id}/attachments/${attachId}`, { method: 'DELETE' });
    return jsonOrThrow<{ id: number; deleted: true }>(res);
}

export async function listSubmissions(
    assignmentId: number,
    query: ListSubmissionsQuery = {},
): Promise<SubmissionListResponse> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${assignmentId}/submissions${buildQuery(query)}`);
    return jsonOrThrow<SubmissionListResponse>(res);
}

export async function getSubmission(assignmentId: number, historyId: number): Promise<SubmissionDetail> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${assignmentId}/submissions/${historyId}`);
    return jsonOrThrow<SubmissionDetail>(res);
}

export async function gradeSubmission(
    assignmentId: number,
    historyId: number,
    payload: GradeSubmissionPayload,
): Promise<{ history_id: number; status: string; grade: number | null }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${assignmentId}/submissions/${historyId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return jsonOrThrow(res);
}

export async function replyToSubmission(
    assignmentId: number,
    historyId: number,
    message: string,
): Promise<{ id: number; created_at: string }> {
    const res = await fetchWithRefresh(`${ASSIGNMENTS_API_BASE}/${assignmentId}/submissions/${historyId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    return jsonOrThrow(res);
}
