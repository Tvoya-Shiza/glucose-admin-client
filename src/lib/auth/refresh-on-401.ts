/**
 * Client-side fetch wrapper that retries ONCE on 401 by hitting POST /api/auth/refresh.
 *
 * Used as the queryFn for every TanStack Query that calls /api/proxy/* or /api/auth/me.
 * Cookie management happens server-side (BFF route handlers); this wrapper only sees
 * the 401 status code and delegates to the BFF refresh route which mints new cookies.
 *
 * Retry policy:
 *   1. Initial fetch
 *   2. If 401 → POST /api/auth/refresh (no body — refresh route reads cookie via cookies()).
 *      - 200 → retry the original request once
 *      - any other status → redirect to /[locale]/login
 *   3. If retry returns 401 → redirect to /[locale]/login (do NOT loop)
 *
 * Concurrent refreshes are coalesced — multiple parallel 401s share a single
 * /api/auth/refresh round-trip instead of fanning out N rotation calls.
 */

import { extractLocaleFromPath, type AdminLocale } from './cookies';

let inFlightRefresh: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
    // Coalesce concurrent refreshes — multiple 401s in flight share one /api/auth/refresh call.
    if (!inFlightRefresh) {
        inFlightRefresh = (async () => {
            try {
                const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
                return res.ok;
            } catch {
                return false;
            } finally {
                // Reset the in-flight flag after the promise settles (so future 401s start a new refresh).
                setTimeout(() => {
                    inFlightRefresh = null;
                }, 0);
            }
        })();
    }
    return inFlightRefresh;
}

function getCurrentLocale(): AdminLocale {
    if (typeof window === 'undefined') return 'kz';
    return extractLocaleFromPath(window.location.pathname);
}

function redirectToLogin(): never {
    if (typeof window !== 'undefined') {
        const locale = getCurrentLocale();
        const next = window.location.pathname + window.location.search;
        window.location.href = `/${locale}/login?next=${encodeURIComponent(next)}`;
    }
    throw new Error('redirected_to_login');
}

export async function fetchWithRefresh(input: string, init: RequestInit = {}): Promise<Response> {
    const merged: RequestInit = { ...init, credentials: 'same-origin' };
    const first = await fetch(input, merged);
    if (first.status !== 401) return first;

    const refreshed = await refreshTokens();
    if (!refreshed) {
        redirectToLogin();
    }

    const second = await fetch(input, merged);
    if (second.status === 401) {
        redirectToLogin();
    }
    return second;
}
