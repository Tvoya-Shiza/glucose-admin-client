/**
 * BFF-bypass upload client (CRS-05 / CONTEXT D-13) — moved from src/lib/courses/
 * during the Phase 5+ unification (it's not a courses concern; banners, blogs,
 * stories, quizzes all use it).
 *
 * The admin-client almost always talks to admin-api via /api/proxy/* (BFF
 * pattern — admin Bearer in HttpOnly cookie, browser never sees it).
 * THIS FILE IS THE EXCEPTION: file upload goes browser -> admin-api directly,
 * authenticated by a short-lived JWT in X-Upload-Token header.
 *
 * Why: streaming a video upload (up to 200MB) through Next.js Route Handlers
 * serializes MBs of data through Node.js memory; direct upload puts it on the
 * admin-api Multer/disk path. The trade-off (a different credential to manage)
 * is documented in glucose-admin-client/CLAUDE.md and CONTEXT D-13.
 *
 * The admin-api MUST be reachable from the browser at the same origin (or
 * CORS allowlist). NEXT_PUBLIC_ADMIN_API_URL provides the absolute origin
 * for cross-origin deployments; falls back to '' (relative) when the admin
 * panel and admin-api share an origin behind nginx.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type {
    ListUploadsQuery,
    ListUploadsResponse,
    UploadFileResult,
    UploadTokenRequest,
    UploadTokenResponse,
} from '@shared/uploads';

/**
 * Browser-visible admin-api origin for the BFF-bypass call.
 * Empty string ('') means "same origin" — the upload_url returned from
 * admin-api begins with `/admin-api/...` which becomes a same-origin request.
 * Set NEXT_PUBLIC_ADMIN_API_URL only when admin-client and admin-api are on
 * different origins (in which case CORS_ORIGINS on admin-api MUST allow it
 * and allowedHeaders MUST include 'X-Upload-Token').
 */
const ADMIN_API_DIRECT_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '';

/**
 * Step 1 (BFF): request a 5-minute upload token. Goes through the proxy so
 * the admin Bearer cookie authenticates the actor; admin-api enforces
 * @Roles('admin','teacher').
 */
export async function requestUploadToken(payload: UploadTokenRequest): Promise<UploadTokenResponse> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/uploads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `upload_token_failed_${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
        return (json as { data: UploadTokenResponse }).data;
    }
    return json as UploadTokenResponse;
}

/**
 * Step 2 (BFF-bypass): POST the file directly to admin-api with X-Upload-Token.
 *
 * Uses XMLHttpRequest because fetch's upload-progress events have weak browser
 * support (only ReadableStream pipes, not exposed by FormData). XHR's
 * `upload.onprogress` is the established cross-browser path.
 *
 * NEVER use fetchWithRefresh here — the admin Bearer cookie is irrelevant
 * for this call; the upload token IS the credential, and a 401 from admin-api
 * should NOT trigger a refresh-token rotation (the user's session is fine,
 * the token just expired).
 */
export interface UploadFileDirectHandle {
    promise: Promise<UploadFileResult>;
    abort: () => void;
}

export function uploadFileDirect(
    uploadUrlPath: string,
    token: string,
    file: File,
    onProgress?: (pct: number) => void,
): UploadFileDirectHandle {
    const url = uploadUrlPath.startsWith('http')
        ? uploadUrlPath
        : `${ADMIN_API_DIRECT_ORIGIN}${uploadUrlPath}`;

    const xhr = new XMLHttpRequest();
    const promise = new Promise<UploadFileResult>((resolve, reject) => {
        xhr.open('POST', url, true);
        xhr.setRequestHeader('X-Upload-Token', token);
        if (onProgress) {
            xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                    const pct = Math.round((ev.loaded / ev.total) * 100);
                    onProgress(pct);
                }
            };
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const parsed = JSON.parse(xhr.responseText);
                    const result: UploadFileResult =
                        parsed && typeof parsed === 'object' && 'data' in parsed
                            ? (parsed as { data: UploadFileResult }).data
                            : (parsed as UploadFileResult);
                    resolve(result);
                } catch {
                    reject(new Error('upload_response_parse_failed'));
                }
            } else {
                let msg = `upload_failed_${xhr.status}`;
                try {
                    const parsed = JSON.parse(xhr.responseText) as { message?: string };
                    if (parsed && typeof parsed.message === 'string') {
                        msg = parsed.message;
                    }
                } catch {
                    // ignore parse error; default msg stands
                }
                reject(new Error(msg));
            }
        };
        xhr.onerror = () => reject(new Error('upload_network_error'));
        xhr.onabort = () => reject(new Error('upload_aborted'));

        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
    });

    return { promise, abort: () => xhr.abort() };
}

/**
 * File-library list — goes through the BFF (admin Bearer cookie). Server scopes
 * results by role (`mine=true` narrows further to the calling actor).
 */
export async function listUploads(query: ListUploadsQuery = {}): Promise<ListUploadsResponse> {
    const qs = new URLSearchParams();
    if (query.kind) qs.set('kind', query.kind);
    if (query.mime) qs.set('mime', query.mime);
    if (query.q) qs.set('q', query.q);
    if (query.mine) qs.set('mine', 'true');
    if (query.page) qs.set('page', String(query.page));
    if (query.per_page) qs.set('per_page', String(query.per_page));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/uploads${suffix}`);
    if (!res.ok) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `uploads_list_failed_${res.status}`;
        throw new Error(msg);
    }
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json && 'meta' in (json as Record<string, unknown>)) {
        return json as ListUploadsResponse;
    }
    if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
        return (json as { data: ListUploadsResponse }).data;
    }
    return json as ListUploadsResponse;
}

export async function deleteUpload(id: string): Promise<void> {
    const res = await fetchWithRefresh(`/api/proxy/v1/admin/uploads/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const msg = (json as { message?: string })?.message ?? `uploads_delete_failed_${res.status}`;
        throw new Error(msg);
    }
}
