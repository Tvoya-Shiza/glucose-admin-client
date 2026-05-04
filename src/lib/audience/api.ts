'use client';
/**
 * Phase 8 Plan 01 — BFF wrapper for audience preview.
 * Body is a STUB — Plan 02 fills it with fetchWithRefresh against
 * POST /api/proxy/admin-api/v1/admin/push/audience-preview.
 */
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import type { AudienceShape, AudiencePreview } from './types';

// TODO Plan 02: implement
export async function previewAudience(_audience: AudienceShape): Promise<AudiencePreview> {
    throw new Error('previewAudience: stub — Plan 02 not landed yet');
}

void fetchWithRefresh;
