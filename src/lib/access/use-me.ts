'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

export interface MeData {
    user_id: number;
    email: string | null;
    role_name: 'admin' | 'curator' | 'teacher';
    role_id: number;
    is_super: boolean;
    permissions: string[];
}

interface MeEnvelope {
    success: boolean;
    status?: string;
    message?: string;
    data?: MeData;
}

/**
 * Shared TanStack Query for the current admin user's identity + permissions.
 *
 * Single source of truth used by:
 *   - admin-nav (filter menu items by required permission)
 *   - usePermission / <Can> (gate buttons + sections)
 *   - sidebar footer (display email + role)
 *
 * staleTime: 60s — keeps the network quiet while still picking up role/permission
 * changes within a minute (PUT /access/roles/:id/permissions also invalidates this
 * queryKey for instant refresh when the user themselves is the editor).
 */
// IMPORTANT: do NOT use the bare ['auth.me'] key — 12+ legacy list/detail clients
// (groups, banners, stories, courses, quizzes, promocodes, dashboard, sidebar-footer,
// etc.) define their own useQuery({ queryKey: ['auth.me'], queryFn: r => r.json() })
// which caches the FULL envelope (success/status/message/data). useMe unwraps to
// envelope.data, so sharing the key produces alternating envelope vs unwrapped
// reads depending on which queryFn wrote the cache last. A dedicated key keeps
// the two cache entries independent.
export const ME_QUERY_KEY = ['access', 'me'] as const;

export function useMe(): UseQueryResult<MeData | undefined> {
    return useQuery({
        queryKey: ME_QUERY_KEY,
        queryFn: async (): Promise<MeData | undefined> => {
            const res = await fetchWithRefresh('/api/auth/me');
            const envelope = (await res.json()) as MeEnvelope;
            return envelope.data;
        },
        staleTime: 60_000,
    });
}
