import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAdminApi, extractSetCookies } from '@/lib/auth/admin-api-client';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/refresh
 *
 * Reads the glc_admin_rt httpOnly cookie via cookies() (server-side only — the
 * browser cannot read it from JS). Forwards { refresh_token } as a body field to
 * admin-api POST /admin-api/auth/refresh, then mirrors the rotated Set-Cookie pair
 * back to the browser.
 *
 * If no refresh cookie is present, return 401 immediately — there is nothing to
 * forward and admin-api would reject an empty body anyway.
 */
export async function POST() {
    const store = await cookies();
    const refresh = store.get(REFRESH_COOKIE)?.value;
    if (!refresh) {
        return NextResponse.json(
            { success: false, status: 'no_refresh_token', message: 'admin.auth.no_refresh_token' },
            { status: 401 },
        );
    }

    const upstream = await fetchAdminApi('/admin-api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
    });

    let data: unknown;
    try {
        data = await upstream.json();
    } catch {
        data = { success: false, status: 'upstream_error', message: 'admin.auth.upstream_error' };
    }

    const res = NextResponse.json(data, { status: upstream.status });
    for (const sc of extractSetCookies(upstream)) {
        res.headers.append('Set-Cookie', sc);
    }
    return res;
}
