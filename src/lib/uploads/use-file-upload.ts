'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestUploadToken, uploadFileDirect, type UploadFileDirectHandle } from './client';
import { KIND_MAX_BYTES, MIME_BY_KIND } from './constants';
import { mapUploadErrorToI18nKey } from './errors';
import type { UploadContentType, UploadFileResult, UploadKind, UploaderMeta, UploaderState } from './types';

export interface UseFileUploadOptions {
    kind: UploadKind;
    /** Optional override of the kind cap — only narrower values take effect. */
    maxSize?: number;
    /** Optional override of the MIME whitelist — must be a subset of MIME_BY_KIND[kind]. */
    accept?: ReadonlyArray<UploadContentType>;
    /** Called on the terminal success state with the uploaded URL + metadata. */
    onSuccess?: (url: string, meta: UploaderMeta) => void;
    /** Called whenever the hook moves to the `error` state. */
    onError?: (i18nKey: string, raw: Error) => void;
}

export interface UseFileUploadReturn {
    state: UploaderState;
    progress: number;
    error: { i18nKey: string; raw: Error } | null;
    upload: (file: File) => void;
    reset: () => void;
    cancel: () => void;
}

/**
 * State-machine hook around the two-step BFF-bypass upload (request token →
 * direct POST). Owns:
 *
 *   - Client-side pre-flight (MIME whitelist + size cap) so we don't burn
 *     server-side single-use tokens on inputs the browser can reject.
 *   - Progress reporting from XHR upload.onprogress.
 *   - Abort: cancels the in-flight XHR cleanly; safe to call any time.
 *   - Stale-callback guards: ignores results of an upload that was reset/aborted.
 *
 * Consumers receive `(state, progress, error, upload, reset, cancel)`. The
 * <FileUploader> UI component is the only intended caller; tests and Tiptap
 * call it directly too.
 */
export function useFileUpload({ kind, maxSize, accept, onSuccess, onError }: UseFileUploadOptions): UseFileUploadReturn {
    const [state, setState] = useState<UploaderState>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<{ i18nKey: string; raw: Error } | null>(null);

    // Track the in-flight handle so cancel() and unmount can abort it.
    const inflightRef = useRef<UploadFileDirectHandle | null>(null);
    // Bump on each upload() call; results from a stale generation are dropped.
    const generationRef = useRef(0);

    useEffect(() => {
        return () => {
            inflightRef.current?.abort();
        };
    }, []);

    const reset = useCallback(() => {
        generationRef.current += 1;
        inflightRef.current?.abort();
        inflightRef.current = null;
        setState('idle');
        setProgress(0);
        setError(null);
    }, []);

    const cancel = useCallback(() => {
        if (inflightRef.current) {
            inflightRef.current.abort();
            inflightRef.current = null;
        }
    }, []);

    const upload = useCallback(
        (file: File) => {
            const generation = ++generationRef.current;
            setError(null);
            setProgress(0);

            // ── Pre-flight: MIME ─────────────────────────────────────────────
            const allowedMimes = accept ?? MIME_BY_KIND[kind];
            if (!allowedMimes.includes(file.type as UploadContentType)) {
                const err = new Error('upload_mime_not_allowed');
                const i18nKey = mapUploadErrorToI18nKey(err.message);
                setState('error');
                setError({ i18nKey, raw: err });
                onError?.(i18nKey, err);
                return;
            }

            // ── Pre-flight: size ─────────────────────────────────────────────
            const cap = Math.min(KIND_MAX_BYTES[kind], maxSize ?? Infinity);
            if (file.size > cap) {
                const err = new Error('upload_size_too_large');
                const i18nKey = mapUploadErrorToI18nKey(err.message);
                setState('error');
                setError({ i18nKey, raw: err });
                onError?.(i18nKey, err);
                return;
            }

            const finishError = (raw: Error) => {
                if (generationRef.current !== generation) return; // stale
                inflightRef.current = null;
                const i18nKey = mapUploadErrorToI18nKey(raw.message);
                setState('error');
                setError({ i18nKey, raw });
                onError?.(i18nKey, raw);
            };

            const finishSuccess = (result: UploadFileResult, original_name: string) => {
                if (generationRef.current !== generation) return; // stale
                inflightRef.current = null;
                setState('done');
                setProgress(100);
                onSuccess?.(result.file_url, {
                    mime: result.content_type,
                    size: result.size,
                    original_name,
                });
            };

            setState('requesting');
            requestUploadToken({
                kind,
                size: file.size,
                content_type: file.type as UploadContentType,
            })
                .then((token) => {
                    if (generationRef.current !== generation) return; // aborted before token came back
                    setState('uploading');
                    const handle = uploadFileDirect(token.upload_url, token.token, file, (pct) => {
                        if (generationRef.current !== generation) return;
                        setProgress(pct);
                    });
                    inflightRef.current = handle;
                    handle.promise.then((result) => finishSuccess(result, file.name)).catch(finishError);
                })
                .catch(finishError);
        },
        [kind, maxSize, accept, onSuccess, onError],
    );

    return { state, progress, error, upload, reset, cancel };
}
