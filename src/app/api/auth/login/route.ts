import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminApi, extractSetCookies } from '@/lib/auth/admin-api-client';

// fetch + Headers.getSetCookie() require Node 20+; pin to the Node runtime so the
// cookie passthrough is bit-exact. Edge runtime is reserved for the Edge middleware.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login
 *
 * Forwards { email, password } to admin-api POST /admin-api/auth/login server-to-server,
 * then mirrors the upstream Set-Cookie headers (glc_admin_at + glc_admin_rt) onto the
 * browser response so the cookies bind to the admin-client host (admin.glucose.kz),
 * not the admin-api host.
 *
 * Browser never sees the JWT — admin-api sets HttpOnly cookies; this route forwards them.
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, status: 'invalid_body', message: 'admin.auth.invalid_body' },
            { status: 400 },
        );
    }

    const upstream = await fetchAdminApi('/admin-api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    let data: unknown;
    try {
        data = await upstream.json();
    } catch {
        data = { success: false, status: 'upstream_error', message: 'admin.auth.upstream_error' };
    }

    const res = NextResponse.json(data, { status: upstream.status });

    // Mirror Set-Cookie headers from admin-api so the browser stores glc_admin_at + glc_admin_rt.
    // admin-api already sets HttpOnly/SameSite=Lax/Secure (prod)/Path=/ — we just pass them through.
    // The cookies bind to THIS response's host (admin-client), not admin-api's host.
    for (const sc of extractSetCookies(upstream)) {
        res.headers.append('Set-Cookie', sc);
    }
    return res;
}
