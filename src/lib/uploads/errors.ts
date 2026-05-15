/**
 * Map upload-related error messages (raw server strings + client-side codes)
 * to i18n keys under the `upload.*` namespace.
 *
 * Why centralize: 8 callsites used to each match strings inline. Diverging
 * matches caused some surfaces to show a generic "upload_failed" while others
 * had specific copy. Single mapping = single localization gap to fix.
 *
 * Server keys come from admin-api UploadsService throws (`upload.token_*`,
 * `upload.content_type_*`, `upload.size_*`, `upload.write_failed`). Client
 * keys come from pre-flight validation in `useFileUpload`.
 */
export function mapUploadErrorToI18nKey(message: string | undefined): string {
    if (!message) {
        return 'upload.failed';
    }

    // Server-side keys (UploadsService throws these as exception messages).
    if (message === 'upload.token_missing' || message === 'upload.token_invalid') {
        return 'upload.token_expired';
    }
    if (message === 'upload.token_already_used') {
        return 'upload.already_used';
    }
    if (message === 'upload.content_type_not_allowed' || message === 'upload.content_type_mismatch') {
        return 'upload.mime_not_allowed';
    }
    if (message.startsWith('upload.size_exceeds')) {
        return 'upload.file_too_large';
    }
    if (message === 'upload.write_failed' || message === 'upload.path_resolution_failed') {
        return 'upload.failed';
    }
    if (message === 'upload.file_missing') {
        return 'upload.failed';
    }
    if (message === 'upload.asset_not_found') {
        return 'upload.asset_not_found';
    }

    // Client-side codes (useFileUpload pre-flight + transport).
    if (message === 'upload_mime_not_allowed') {
        return 'upload.mime_not_allowed';
    }
    if (message === 'upload_size_too_large') {
        return 'upload.file_too_large';
    }
    if (message === 'upload_aborted') {
        return 'upload.aborted';
    }
    if (message === 'upload_network_error') {
        return 'upload.network_error';
    }
    if (message === 'upload_response_parse_failed') {
        return 'upload.failed';
    }
    if (message.startsWith('upload_failed_')) {
        return 'upload.failed';
    }
    if (message.startsWith('upload_token_failed_')) {
        return 'upload.failed';
    }

    return 'upload.failed';
}
