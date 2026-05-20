import type { UploadContentType, UploadKind } from '@shared/uploads';

/**
 * Single source of truth for upload limits + MIME ↔ kind mapping on the client.
 *
 * The server is authoritative — values here mirror UploadsService (admin-api).
 * Client-side validation against these values is purely UX: it prevents the
 * round-trip of "request a token, send the file, get rejected" for cases the
 * browser can already detect.
 *
 * If these diverge from admin-api, the server still rejects — never assume
 * client-side validation is enough.
 */

export const KIND_MAX_BYTES: Record<UploadKind, number> = {
    image: 10 * 1024 * 1024,
    cover: 10 * 1024 * 1024,
    video: 200 * 1024 * 1024,
    // Phase 14 — documents (assignment attachments + future doc uploads).
    document: 50 * 1024 * 1024,
};

export const MIME_BY_KIND: Record<UploadKind, ReadonlyArray<UploadContentType>> = {
    image: ['image/jpeg', 'image/png', 'image/webp'],
    cover: ['image/jpeg', 'image/png', 'image/webp'],
    video: ['video/mp4', 'video/webm'],
    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
    ],
};

export const EXT_BY_MIME: Record<UploadContentType, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    // Phase 14 — documents.
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'application/zip': '.zip',
};

/** `accept` attribute value for `<input type="file">`, joined by comma. */
export function acceptForKind(kind: UploadKind): string {
    return MIME_BY_KIND[kind].join(',');
}

/** Human-readable size cap (used in toasts/labels). */
export function maxSizeMb(kind: UploadKind): number {
    return Math.round(KIND_MAX_BYTES[kind] / (1024 * 1024));
}
