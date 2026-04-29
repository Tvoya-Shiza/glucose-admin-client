import 'server-only';

/**
 * Server-only helper for forwarding requests to admin-api.
 *
 * Never imported in client components — `import 'server-only'` enforces this at build
 * time (Next.js inserts a build-time error if a Client Component pulls this in).
 *
 * Why this exists:
 *   - Centralizes the admin-api origin (process.env.ADMIN_API_URL — NO NEXT_PUBLIC_ prefix
 *     so the URL never enters the client bundle).
 *   - Centralizes the Set-Cookie passthrough used by /api/auth/login + /api/auth/refresh
 *     so each route handler stays small.
 *
 * Cookie attributes here mirror what admin-api sets (Plan 04 auth.controller.ts):
 *   HttpOnly + SameSite=Lax + Secure (prod only) + Path=/ + no Domain attr (host-only).
 */

export interface CookieAttrs {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge?: number; // seconds
}

export const adminApiUrl = (): string => {
    const url = process.env.ADMIN_API_URL;
    if (!url) {
        throw new Error('ADMIN_API_URL is not configured');
    }
    return url.replace(/\/+$/, ''); // strip trailing slash
};

export const isProd = (): boolean => process.env.NODE_ENV === 'production';

export const baseCookieAttrs = (): CookieAttrs => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
});

/**
 * Forward a request to admin-api, returning the raw upstream Response.
 * Caller decides what to do with status, headers, body.
 *
 * `cache: 'no-store'` — auth endpoints must never be cached at the fetch layer.
 * No `credentials: 'include'` — we are server-to-server, not browser-mediated.
 */
export async function fetchAdminApi(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${adminApiUrl()}${path.startsWith('/') ? path : '/' + path}`;
    return fetch(url, {
        ...init,
        cache: 'no-store',
    });
}

/**
 * Parse the Set-Cookie header(s) from an upstream Response.
 * Returns an array of raw Set-Cookie strings to be appended to the BFF response.
 *
 * Headers.getSetCookie() is the only correct way to read multiple Set-Cookie
 * headers in Node 20+. The fallback path is approximate (does not handle commas
 * inside cookie expiry dates) and only triggers on Edge runtime polyfills that
 * lack getSetCookie — admin-api emits cookies without bare commas in values, so
 * the fallback is safe in practice for THIS repo's traffic.
 */
export function extractSetCookies(res: Response): string[] {
    const headers = res.headers as unknown as { getSetCookie?: () => string[] };
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie();
    }
    const single = res.headers.get('set-cookie');
    return single ? [single] : [];
}
