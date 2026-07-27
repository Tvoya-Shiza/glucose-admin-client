import { adminMiddleware } from '@/lib/auth/middleware-compose';

export default adminMiddleware;

export const config = {
    // Match every path EXCEPT:
    //  - /api/*       (BFF route handlers — they manage their own auth)
    //  - /_next/*     (Next.js internals)
    //  - /_vercel/*   (Vercel-specific)
    //  - static files (anything with a literal dot — favicon.ico, *.png, *.css, etc.)
    //
    // The login path is NOT in this exclusion list because next-intl needs to rewrite
    // /login → /ru/login (or /kz/login) — that work happens in the auth middleware's
    // public-path branch.
    matcher: ['/', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
