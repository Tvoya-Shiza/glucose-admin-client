import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAdminApi, baseCookieAttrs } from '@/lib/auth/admin-api-client';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 *
 * Reads cookies server-side, forwards to admin-api POST /admin-api/auth/logout
 * (best-effort — even on upstream failure, local cookies MUST clear), then sets
 * Max-Age=0 on glc_admin_at + glc_admin_rt to wipe the browser store.
 *
 * Body shape contract with upstream LogoutDto (Plan 04):
 *   - LogoutDto's refresh_token is @IsOptional() + @IsString() — accepts {} or
 *     { refresh_token: '<jwt>' } but REJECTS { refresh_token: null } because
 *     @IsString() runs at runtime even when the field is optional.
 *   - Therefore: when no refresh cookie is present, omit the field entirely.
 *     NEVER send null. (Per checker review W3.)
 */
export async function POST() {
    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value;
    const refresh = store.get(REFRESH_COOKIE)?.value;

    // Build body conditionally — omit the field rather than sending null.
    const upstreamBody: Record<string, string> = {};
    if (refresh) {
        upstreamBody.refresh_token = refresh;
    }

    // Forward to admin-api (best-effort — local cookies clear regardless).
    try {
        await fetchAdminApi('/admin-api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(access ? { Authorization: `Bearer ${access}` } : {}),
            },
            body: JSON.stringify(upstreamBody),
        });
    } catch {
        // Idempotent — swallow upstream errors. Audit trail of the failure is admin-api's
        // problem, not the BFF's.
    }

    // Always clear local cookies.
    const res = NextResponse.json({ success: true, status: 'logout', message: 'admin.auth.logout' });
    const attrs = baseCookieAttrs();
    res.cookies.set(ACCESS_COOKIE, '', { ...attrs, maxAge: 0 });
    res.cookies.set(REFRESH_COOKIE, '', { ...attrs, maxAge: 0 });
    return res;
}
