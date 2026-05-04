'use client';
/**
 * Phase 8 Plan 02 — BFF wrapper for audience preview.
 *
 * Hits POST /api/proxy/v1/admin/push/audience-preview which the proxy
 * forwards to admin-api as /admin-api/v1/admin/push/audience-preview with
 * the access-token Bearer attached server-to-server (browser never sees JWT).
 *
 * Wired into useAudiencePreview() (TanStack Query) for the AudienceSelector
 * compose flow + AudiencePreview render. Used by Plans 03/04/05 compose pages.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { AudienceShape, AudiencePreview } from './types';

export async function previewAudience(audience: AudienceShape): Promise<AudiencePreview> {
    const res = await fetchWithRefresh('/api/proxy/v1/admin/push/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audience),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`previewAudience: ${res.status} ${text || res.statusText}`);
    }
    return (await res.json()) as AudiencePreview;
}
