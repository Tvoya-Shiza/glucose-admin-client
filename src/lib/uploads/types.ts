/**
 * Local + shared upload types. Re-exports the cross-repo `@shared/uploads`
 * contracts plus the client-only state shapes consumed by useFileUpload.
 */
export type {
    ListUploadsQuery,
    ListUploadsResponse,
    UploadAsset,
    UploadContentType,
    UploadFileResult,
    UploadKind,
    UploadTokenRequest,
    UploadTokenResponse,
} from '@shared/uploads';

/** State of a single in-flight upload. */
export type UploaderState = 'idle' | 'validating' | 'requesting' | 'uploading' | 'done' | 'error';

/** Result metadata returned to onChange listeners (in addition to the URL). */
export interface UploaderMeta {
    mime: string;
    size: number;
    original_name: string | null;
}
