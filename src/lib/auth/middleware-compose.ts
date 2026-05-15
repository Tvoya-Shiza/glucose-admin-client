import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { ACCESS_COOKIE, buildLoginUrl } from './cookies';
import { verifyAdminJwt } from './jwt-verify';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Public path predicate — paths the auth middleware MUST NOT redirect away from.
 * Login pages and any /api/auth/* handlers are public; everything else under [locale]
 * requires a valid access cookie.
 *
 * NOTE: /api/* and /_next/* are already excluded by the matcher in middleware.ts;
 * this predicate handles per-locale paths under [locale]/login + bare /login.
 */
function isPublicPath(pathname: string): boolean {
    // Match /login, /kz/login (with or without trailing slash or sub-path).
    if (/^\/(kz\/)?login(\/|$)/.test(pathname)) return true;
    // Match /favicon.ico (Next 16 may surface it through middleware in some setups)
    if (pathname === '/favicon.ico') return true;
    return false;
}

export async function adminMiddleware(req: NextRequest): Promise<NextResponse> {
    const pathname = req.nextUrl.pathname;

    // Legacy locale redirect: /ru/* → /kz/* (Russian was removed; preserve link-stability).
    if (pathname === '/ru' || pathname.startsWith('/ru/')) {
        const next = pathname.replace(/^\/ru/, '/kz') + req.nextUrl.search;
        return NextResponse.redirect(new URL(next, req.url), 307);
    }

    // Public paths skip auth check; still pass through next-intl for locale rewriting.
    if (isPublicPath(pathname)) {
        return intlMiddleware(req);
    }

    // Auth gate.
    const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
    const claims = await verifyAdminJwt(accessToken);

    if (!claims) {
        // No valid access token → redirect to locale-aware login.
        // Carry the original target as ?next= so the login page can redirect back after success.
        // Note: the ?next= value is ONLY consumed by the login page (Plan 07), which validates
        // it's a same-origin path before redirecting. Middleware does not honor it for redirects.
        const loginUrl = buildLoginUrl({ url: req.url, nextUrl: req.nextUrl });
        loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    // Authenticated — delegate to next-intl middleware for locale handling.
    return intlMiddleware(req);
}
