import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAdminApi } from '@/lib/auth/admin-api-client';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generic BFF proxy — AUTH-09.
 *
 * Browser hits /api/proxy/users/123  →  this route  →  admin-api /admin-api/users/123
 *
 * Bearer token is attached server-to-server from the access cookie; the browser
 * NEVER sees the JWT, satisfying the cookie-flow contract.
 *
 * Refresh-on-401 is NOT handled here — it lives client-side in lib/auth/refresh-on-401.ts
 * (Plan 07). When admin-api returns 401, we forward 401 to the browser; the client
 * fetch wrapper retries after calling /api/auth/refresh.
 *
 * Defense-in-depth: we DO NOT forward the browser's Cookie header to admin-api.
 * admin-api authorizes via Bearer header only — if it ever started honoring cookies
 * in the future, that would be a regression and shouldn't be made easier by us
 * silently passing them through.
 */

async function handle(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
    const subPath = '/' + params.path.join('/');
    const targetPath = `/admin-api${subPath}${req.nextUrl.search}`;

    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value;

    const headers = new Headers();
    // Forward only content-type + accept; do NOT forward Cookie (defense-in-depth).
    const ct = req.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const accept = req.headers.get('accept');
    if (accept) headers.set('Accept', accept);
    if (access) headers.set('Authorization', `Bearer ${access}`);

    const init: RequestInit = {
        method: req.method,
        headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        // Stream body straight through — handles JSON, multipart, raw bytes.
        init.body = req.body as unknown as BodyInit;
        // Node 20+ fetch requires `duplex: 'half'` when sending a streaming request body.
        // The cast works around the missing typing in current lib defs.
        (init as RequestInit & { duplex?: 'half' }).duplex = 'half';
    }

    const upstream = await fetchAdminApi(targetPath, init);

    // Pass through status + body. Headers: copy Content-Type only — never reflect
    // upstream Set-Cookie (the BFF owns cookie management; auth routes are the
    // only places cookies can be set/cleared) and never reflect Authorization.
    const resHeaders = new Headers();
    const upstreamCt = upstream.headers.get('content-type');
    if (upstreamCt) resHeaders.set('Content-Type', upstreamCt);

    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
    });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handle(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handle(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handle(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handle(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handle(req, await params);
}
