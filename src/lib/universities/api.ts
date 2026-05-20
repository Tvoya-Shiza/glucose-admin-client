import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    AdmissionStatListResponse,
    AdmissionStatRow,
    AnalyticsResponse,
    ImportKind,
    ImportResult,
    ListAdmissionStatsQuery,
    ListSpecialtiesQuery,
    ListUniversitiesQuery,
    SpecialtyListResponse,
    SpecialtyListRow,
    UniversityDetail,
    UniversityListResponse,
    UniversitySpecialtyRow,
    UpsertAdmissionStatPayload,
    UpsertSpecialtyPayload,
    UpsertUniversityPayload,
    UpsertUniversitySpecialtyPayload,
} from './types';

/**
 * Phase 17 — typed wrappers around the admin-api universities/specialties endpoints.
 *
 * All calls go through the BFF proxy `/api/proxy/v1/admin/...` — never directly to
 * admin-api (CLAUDE.md "Bypassing the BFF proxy" forbidden).
 *
 * GET list endpoints return the raw shape `{ rows, total, pageCount }`.
 * Mutation endpoints are apiResponse-wrapped — we unwrap `.data`.
 */

const UNI = '/api/proxy/v1/admin/universities';
const SPEC = '/api/proxy/v1/admin/specialties';
const STATS = '/api/proxy/v1/admin/admission-stats';

function buildQuery(q: Record<string, unknown> | undefined): string {
    if (!q) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

async function ok<T>(res: Response, label: string): Promise<T> {
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `${label} failed: ${res.status}`;
        throw new Error(msg);
    }
    return res.json();
}

async function okUnwrap<T>(res: Response, label: string): Promise<T> {
    const json = (await ok<unknown>(res, label)) as { data?: T };
    return (json?.data ?? (json as unknown)) as T;
}

// ----- universities -----

export async function listUniversities(q?: ListUniversitiesQuery): Promise<UniversityListResponse> {
    const res = await fetchWithRefresh(`${UNI}${buildQuery(q as Record<string, unknown>)}`);
    return ok<UniversityListResponse>(res, 'listUniversities');
}

export async function getUniversity(id: number | string): Promise<UniversityDetail> {
    const res = await fetchWithRefresh(`${UNI}/${encodeURIComponent(String(id))}`);
    return okUnwrap<UniversityDetail>(res, 'getUniversity');
}

export async function createUniversity(payload: UpsertUniversityPayload): Promise<UniversityDetail> {
    const res = await fetchWithRefresh(UNI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<UniversityDetail>(res, 'createUniversity');
}

export async function updateUniversity(id: number, payload: UpsertUniversityPayload): Promise<UniversityDetail> {
    const res = await fetchWithRefresh(`${UNI}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<UniversityDetail>(res, 'updateUniversity');
}

export async function deleteUniversity(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${UNI}/${id}`, { method: 'DELETE' });
    return okUnwrap<{ id: number; deleted: true }>(res, 'deleteUniversity');
}

// ----- specialties (directory) -----

export async function listSpecialties(q?: ListSpecialtiesQuery): Promise<SpecialtyListResponse> {
    const res = await fetchWithRefresh(`${SPEC}${buildQuery(q as Record<string, unknown>)}`);
    return ok<SpecialtyListResponse>(res, 'listSpecialties');
}

export async function createSpecialty(payload: UpsertSpecialtyPayload): Promise<SpecialtyListRow> {
    const res = await fetchWithRefresh(SPEC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<SpecialtyListRow>(res, 'createSpecialty');
}

export async function updateSpecialty(id: number, payload: UpsertSpecialtyPayload): Promise<SpecialtyListRow> {
    const res = await fetchWithRefresh(`${SPEC}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<SpecialtyListRow>(res, 'updateSpecialty');
}

export async function deleteSpecialty(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${SPEC}/${id}`, { method: 'DELETE' });
    return okUnwrap<{ id: number; deleted: true }>(res, 'deleteSpecialty');
}

// ----- university × specialty links -----

export async function listUniversitySpecialties(universityId: number): Promise<UniversitySpecialtyRow[]> {
    const res = await fetchWithRefresh(`${UNI}/${universityId}/specialties`);
    return ok<UniversitySpecialtyRow[]>(res, 'listUniversitySpecialties');
}

export async function linkSpecialty(
    universityId: number,
    payload: UpsertUniversitySpecialtyPayload,
): Promise<UniversitySpecialtyRow> {
    const res = await fetchWithRefresh(`${UNI}/${universityId}/specialties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<UniversitySpecialtyRow>(res, 'linkSpecialty');
}

export async function updateUniversitySpecialty(
    universityId: number,
    linkId: number,
    payload: UpsertUniversitySpecialtyPayload,
): Promise<UniversitySpecialtyRow> {
    const res = await fetchWithRefresh(`${UNI}/${universityId}/specialties/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<UniversitySpecialtyRow>(res, 'updateUniversitySpecialty');
}

export async function unlinkSpecialty(universityId: number, linkId: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${UNI}/${universityId}/specialties/${linkId}`, { method: 'DELETE' });
    return okUnwrap<{ id: number; deleted: true }>(res, 'unlinkSpecialty');
}

// ----- admission stats -----

export async function listAdmissionStats(q?: ListAdmissionStatsQuery): Promise<AdmissionStatListResponse> {
    const res = await fetchWithRefresh(`${STATS}${buildQuery(q as Record<string, unknown>)}`);
    return ok<AdmissionStatListResponse>(res, 'listAdmissionStats');
}

export async function upsertAdmissionStat(payload: UpsertAdmissionStatPayload): Promise<AdmissionStatRow> {
    const res = await fetchWithRefresh(STATS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return okUnwrap<AdmissionStatRow>(res, 'upsertAdmissionStat');
}

export async function deleteAdmissionStat(id: number): Promise<{ id: number; deleted: true }> {
    const res = await fetchWithRefresh(`${STATS}/${id}`, { method: 'DELETE' });
    return okUnwrap<{ id: number; deleted: true }>(res, 'deleteAdmissionStat');
}

// ----- analytics -----

export async function getAnalytics(): Promise<AnalyticsResponse> {
    const res = await fetchWithRefresh(`${UNI}/analytics`);
    return ok<AnalyticsResponse>(res, 'getAnalytics');
}

// ----- Excel template / export / import -----

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function downloadTemplate(kind: ImportKind): Promise<Blob> {
    const res = await fetchWithRefresh(`${UNI}/template/${kind}`);
    if (!res.ok) throw new Error(`downloadTemplate failed: ${res.status}`);
    return res.blob();
}

export async function exportData(kind: ImportKind): Promise<Blob> {
    const res = await fetchWithRefresh(`${UNI}/export/${kind}`, { method: 'POST' });
    if (!res.ok) throw new Error(`exportData failed: ${res.status}`);
    return res.blob();
}

export async function importExcel(opts: {
    kind: ImportKind;
    mode: 'dry_run' | 'commit';
    file: File;
    bulkOpId?: string;
    confirmedCount?: number;
}): Promise<ImportResult> {
    const usp = new URLSearchParams({ kind: opts.kind, mode: opts.mode });
    if (opts.bulkOpId) usp.set('bulk_op_id', opts.bulkOpId);
    if (typeof opts.confirmedCount === 'number') usp.set('confirmed_count', String(opts.confirmedCount));

    const fd = new FormData();
    fd.append('file', opts.file, opts.file.name);

    const res = await fetchWithRefresh(`${UNI}/import?${usp.toString()}`, {
        method: 'POST',
        body: fd,
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `importExcel failed: ${res.status}`;
        throw new Error(msg);
    }
    const json = (await res.json()) as { data?: ImportResult };
    return (json?.data ?? (json as unknown)) as ImportResult;
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
    if (blob.type === '' || !blob.type.includes('spreadsheetml')) {
        // Force the XLSX MIME if the proxy didn't preserve it.
        blob = new Blob([blob], { type: XLSX_MIME });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
