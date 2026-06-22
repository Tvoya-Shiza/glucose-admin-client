'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestUploadToken, uploadFileDirect, type UploadFileDirectHandle } from './client';
import { KIND_MAX_BYTES, MIME_BY_KIND } from './constants';
import { mapUploadErrorToI18nKey } from './errors';
import type { UploadContentType, UploadFileResult, UploadKind } from './types';

/**
 * Batch (multi-file) upload orchestrator for the file library page.
 *
 * Each picked file runs through the SAME two-step BFF-bypass flow as the
 * single-file <useFileUpload> hook (request a 5-min single-use token → direct
 * POST to admin-api). We deliberately do NOT change the server to accept
 * multiple files per request: the upload token is signed per-file (it embeds
 * that file's size + content_type and is single-use via Redis jti), so the
 * correct way to upload N files is N independent token+upload cycles.
 *
 * This hook owns:
 *   - Per-file client pre-flight (MIME whitelist + size cap per kind) so we
 *     don't burn tokens on inputs the browser can already reject.
 *   - A bounded-concurrency queue (default 3 in flight) so picking 20 files
 *     doesn't open 20 simultaneous uploads.
 *   - Per-file state/progress for a progress panel, plus a byte-weighted
 *     aggregate progress for the trigger button.
 *   - A single `onSettled` callback fired once when the batch drains (used to
 *     invalidate the list query + show one summary toast instead of N).
 */

export type MultiUploadItemState = 'idle' | 'requesting' | 'uploading' | 'done' | 'error';

export interface MultiUploadItem {
    /** Local id (stable for the lifetime of this batch entry). */
    id: string;
    file: File;
    kind: UploadKind;
    state: MultiUploadItemState;
    /** 0–100, transport progress while `uploading`. */
    progress: number;
    error: { i18nKey: string; raw: Error } | null;
    result: UploadFileResult | null;
}

export interface UseMultiFileUploadOptions {
    /** Destination folder for every file in the batch. null/undefined = root. */
    folderId?: number | null;
    /** Map a picked file to its upload kind (mirrors the page's routing rules). */
    resolveKind: (file: File) => UploadKind;
    /** Max simultaneous in-flight uploads. Default 3. */
    concurrency?: number;
    /** Fired once per file that finishes successfully. */
    onItemSuccess?: (item: MultiUploadItem) => void;
    /** Fired once when the batch drains (no idle/in-flight items remain). */
    onSettled?: (items: MultiUploadItem[]) => void;
}

export interface UseMultiFileUploadReturn {
    items: MultiUploadItem[];
    /** True while any item is idle/requesting/uploading. */
    active: boolean;
    /** 0–100 byte-weighted aggregate across non-errored items. */
    overallProgress: number;
    enqueue: (files: FileList | File[]) => void;
    /** Abort all in-flight uploads and mark queued/in-flight items as aborted. */
    cancelAll: () => void;
    /** Abort everything and empty the panel. */
    clear: () => void;
}

const DEFAULT_CONCURRENCY = 3;

function isLive(state: MultiUploadItemState): boolean {
    return state === 'idle' || state === 'requesting' || state === 'uploading';
}

export function useMultiFileUpload(options: UseMultiFileUploadOptions): UseMultiFileUploadReturn {
    // Keep the latest options in a ref so the engine callbacks below can stay
    // stable (empty-dep useCallback) without going stale on folderId/callbacks.
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const [items, setItems] = useState<MultiUploadItem[]>([]);
    const itemsRef = useRef<MultiUploadItem[]>([]);
    const handlesRef = useRef<Map<string, UploadFileDirectHandle>>(new Map());
    const counterRef = useRef(0);
    // Starts "already notified" so an empty hook never fires onSettled.
    const settledNotifiedRef = useRef(true);

    const commit = useCallback((next: MultiUploadItem[]) => {
        itemsRef.current = next;
        setItems(next);
    }, []);

    const patch = useCallback(
        (id: string, change: Partial<MultiUploadItem>) => {
            commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...change } : it)));
        },
        [commit],
    );

    // Abort any in-flight XHR on unmount.
    useEffect(() => {
        return () => {
            handlesRef.current.forEach((h) => h.abort());
            handlesRef.current.clear();
        };
    }, []);

    const maybeSettle = useCallback(() => {
        if (settledNotifiedRef.current) return;
        if (itemsRef.current.some((it) => isLive(it.state))) return;
        settledNotifiedRef.current = true;
        optionsRef.current.onSettled?.(itemsRef.current);
    }, []);

    // pump() and startItem() reference each other; break the cycle via a ref so
    // both can remain stable across renders.
    const pumpRef = useRef<() => void>(() => {});

    const exists = (id: string) => itemsRef.current.some((it) => it.id === id);

    const startItem = useCallback(
        (item: MultiUploadItem) => {
            patch(item.id, { state: 'requesting', progress: 0, error: null });

            const fail = (raw: Error) => {
                handlesRef.current.delete(item.id);
                if (!exists(item.id)) return;
                patch(item.id, { state: 'error', error: { i18nKey: mapUploadErrorToI18nKey(raw.message), raw } });
                pumpRef.current();
                maybeSettle();
            };

            requestUploadToken({
                kind: item.kind,
                size: item.file.size,
                content_type: item.file.type as UploadContentType,
                folder_id: optionsRef.current.folderId ?? null,
            })
                .then((token) => {
                    if (!exists(item.id)) return; // cleared/aborted before the token returned
                    patch(item.id, { state: 'uploading' });
                    const handle = uploadFileDirect(token.upload_url, token.token, item.file, (pct) => {
                        if (exists(item.id)) patch(item.id, { progress: pct });
                    });
                    handlesRef.current.set(item.id, handle);
                    handle.promise
                        .then((result) => {
                            handlesRef.current.delete(item.id);
                            if (!exists(item.id)) return;
                            patch(item.id, { state: 'done', progress: 100, result });
                            const done = itemsRef.current.find((it) => it.id === item.id);
                            if (done) optionsRef.current.onItemSuccess?.(done);
                            pumpRef.current();
                            maybeSettle();
                        })
                        .catch(fail);
                })
                .catch(fail);
        },
        [patch, maybeSettle],
    );

    const pump = useCallback(() => {
        const concurrency = optionsRef.current.concurrency ?? DEFAULT_CONCURRENCY;
        let inFlight = itemsRef.current.filter((it) => it.state === 'requesting' || it.state === 'uploading').length;
        for (const item of itemsRef.current) {
            if (inFlight >= concurrency) break;
            if (item.state !== 'idle') continue;
            inFlight++;
            startItem(item);
        }
    }, [startItem]);
    pumpRef.current = pump;

    const enqueue = useCallback(
        (files: FileList | File[]) => {
            const list = Array.from(files);
            if (list.length === 0) return;

            // Start a fresh panel when nothing is currently running; otherwise
            // append to the live batch.
            const base = itemsRef.current.some((it) => isLive(it.state)) ? itemsRef.current : [];
            const resolveKind = optionsRef.current.resolveKind;

            const additions = list.map((file): MultiUploadItem => {
                const id = `u${(counterRef.current += 1)}`;
                const kind = resolveKind(file);
                const allowed = MIME_BY_KIND[kind] as ReadonlyArray<string>;
                if (!allowed.includes(file.type)) {
                    const raw = new Error('upload_mime_not_allowed');
                    return { id, file, kind, state: 'error', progress: 0, error: { i18nKey: mapUploadErrorToI18nKey(raw.message), raw }, result: null };
                }
                const cap = KIND_MAX_BYTES[kind] as number;
                if (file.size > cap) {
                    const raw = new Error('upload_size_too_large');
                    return { id, file, kind, state: 'error', progress: 0, error: { i18nKey: mapUploadErrorToI18nKey(raw.message), raw }, result: null };
                }
                return { id, file, kind, state: 'idle', progress: 0, error: null, result: null };
            });

            settledNotifiedRef.current = false;
            commit([...base, ...additions]);
            pump();
            // If every addition failed pre-flight there's nothing to wait on.
            maybeSettle();
        },
        [commit, pump, maybeSettle],
    );

    const cancelAll = useCallback(() => {
        handlesRef.current.forEach((h) => h.abort());
        handlesRef.current.clear();
        const raw = new Error('upload_aborted');
        commit(
            itemsRef.current.map((it) =>
                isLive(it.state) ? { ...it, state: 'error', error: { i18nKey: mapUploadErrorToI18nKey(raw.message), raw } } : it,
            ),
        );
        maybeSettle();
    }, [commit, maybeSettle]);

    const clear = useCallback(() => {
        handlesRef.current.forEach((h) => h.abort());
        handlesRef.current.clear();
        settledNotifiedRef.current = true;
        commit([]);
    }, [commit]);

    const active = items.some((it) => isLive(it.state));
    const sizable = items.filter((it) => it.state !== 'error');
    const totalBytes = sizable.reduce((sum, it) => sum + it.file.size, 0);
    const loadedBytes = sizable.reduce((sum, it) => sum + (it.file.size * (it.state === 'done' ? 100 : it.progress)) / 100, 0);
    const overallProgress = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : items.length > 0 ? 100 : 0;

    return { items, active, overallProgress, enqueue, cancelAll, clear };
}
