'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { previewAudience } from './api';
import type { AudienceShape, AudiencePreview } from './types';

/**
 * Phase 8 Plan 02 — TanStack Query wrapper for audience preview.
 *
 * Behaviour:
 *   - 400ms debounce on `audience` changes — avoids hammering admin-api while
 *     the admin tinkers with filters in <AudienceSelector/>.
 *   - 30s staleTime matches the server-side cache (D-18); back-to-back renders
 *     of the same audience reuse the response without a network round trip.
 *   - The query is enabled only when audience has at least one filter — empty
 *     audiences skip the network call.
 *   - The query key includes the canonical JSON of the debounced shape so
 *     TanStack Query treats two semantically-different audiences as separate
 *     entries (and identical audiences as a single cache entry).
 *
 * Returns the standard useQuery result plus `debouncedAudience` so consumers
 * can distinguish "computing for a new shape..." from "stale-but-final result".
 */
export function useAudiencePreview(audience: AudienceShape | null) {
    const [debounced, setDebounced] = useState<AudienceShape | null>(audience);

    // JSON.stringify on the dependency lets the effect react to shape mutations
    // without callers having to memoise. The serialisation is bounded by
    // AudienceShape (small object), so the cost is negligible.
    const audienceKey = audience ? JSON.stringify(audience) : null;
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(audience), 400);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audienceKey]);

    const enabled = !!debounced && debounced.filters.length > 0;
    const queryKey = ['audience.preview', debounced ? JSON.stringify(debounced) : 'null'];

    const query = useQuery<AudiencePreview>({
        queryKey,
        queryFn: () => previewAudience(debounced as AudienceShape),
        enabled,
        staleTime: 30_000,
        gcTime: 60_000,
        retry: 1,
    });

    return { ...query, debouncedAudience: debounced };
}
