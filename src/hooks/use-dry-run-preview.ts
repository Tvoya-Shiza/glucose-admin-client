'use client';

import { useCallback, useState } from 'react';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

export type DryRunStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DryRunPreviewRow {
    row_id: string;
    status: 'insert' | 'update' | 'skip' | 'error';
    reason: string | null;
}

export interface DryRunResult {
    affected: number;
    insert: number;
    update: number;
    skip: number;
    error: number;
    rows: DryRunPreviewRow[];
}

export interface UseDryRunPreviewApi {
    run: (input: { endpoint: string; body: unknown }) => Promise<void>;
    data: DryRunResult | null;
    status: DryRunStatus;
    error: string | null;
    reset: () => void;
}

/**
 * D-13/D-15/D-16: dry-run preview before any bulk commit. Hits an endpoint that the BFF
 * proxy forwards to admin-api; admin-api computes the same logic as commit but skips
 * writes. The endpoint is configurable so this hook is generic — Plans 05 (bulk
 * provision), 06 (CSV import), and Phase 7 plans all reuse it.
 */
export function useDryRunPreview(): UseDryRunPreviewApi {
    const [data, setData] = useState<DryRunResult | null>(null);
    const [status, setStatus] = useState<DryRunStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(async ({ endpoint, body }: { endpoint: string; body: unknown }) => {
        setStatus('loading');
        setError(null);
        try {
            const res = await fetchWithRefresh(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`dry-run failed: ${res.status}`);
            const json = await res.json();
            const payload = (json?.data ?? json) as DryRunResult;
            setData(payload);
            setStatus('success');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setStatus('error');
        }
    }, []);

    const reset = useCallback(() => {
        setData(null);
        setStatus('idle');
        setError(null);
    }, []);

    return { run, data, status, error, reset };
}
