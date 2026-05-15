/**
 * Cookie names locked across admin-api + admin-client (Phase 2).
 *
 * Names match glucose-admin-api/src/modules/auth/auth.controller.ts ACCESS_COOKIE / REFRESH_COOKIE.
 * If you change one, you MUST change the other.
 *
 * Attributes (set by admin-api AND by Next.js BFF route handlers):
 *   - HttpOnly: true   (browser JS cannot read)
 *   - Secure: prod-only (so localhost over http still works)
 *   - SameSite: Lax    (allows future OAuth redirects; CSRF mitigated by Lax + same-site CORS)
 *   - Path: /          (sent on every admin-client path)
 *   - no Domain attr   (host-only on admin.glucose.kz per STATE.md subdomain decision)
 */
export const ACCESS_COOKIE = 'glc_admin_at';
export const REFRESH_COOKIE = 'glc_admin_rt';

export type AdminLocale = 'kz';

/**
 * Extract the locale prefix from a path. Returns 'kz' for unprefixed paths
 * (matching i18n/routing.ts defaultLocale + localePrefix: 'as-needed').
 */
export function extractLocaleFromPath(pathname: string): AdminLocale {
    const match = pathname.match(/^\/(kz)(\/|$)/);
    return (match?.[1] as AdminLocale | undefined) ?? 'kz';
}

/**
 * Build a locale-prefixed login URL.
 */
export function buildLoginUrl(req: { url: string; nextUrl: { pathname: string } }): URL {
    const locale = extractLocaleFromPath(req.nextUrl.pathname);
    return new URL(`/${locale}/login`, req.url);
}
