import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAdminApi } from '@/lib/auth/admin-api-client';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 *
 * Reads glc_admin_at httpOnly cookie server-side and attaches it as a Bearer header
 * to admin-api GET /admin-api/auth/me, returning the upstream JSON unmodified.
 *
 * Used by the admin-client session shell to hydrate { user_id, email, role_name }
 * after middleware has already verified the JWT signature on the page render.
 */
export async function GET() {
    const store = await cookies();
    const access = store.get(ACCESS_COOKIE)?.value;
    if (!access) {
        return NextResponse.json(
            { success: false, status: 'unauthorized', message: 'admin.auth.unauthorized' },
            { status: 401 },
        );
    }

    const upstream = await fetchAdminApi('/admin-api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${access}` },
    });

    const data = await upstream.json().catch(() => ({
        success: false,
        status: 'upstream_error',
        message: 'admin.auth.upstream_error',
    }));
    return NextResponse.json(data, { status: upstream.status });
}
