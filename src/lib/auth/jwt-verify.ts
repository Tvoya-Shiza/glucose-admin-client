import { jwtVerify, type JWTPayload } from 'jose';

export interface AdminJwtClaims extends JWTPayload {
    sub?: string;
    role_name?: string;
    email?: string | null;
    jti?: string;
}

/**
 * Verify an admin-api access token using the shared HS256 secret.
 * Returns null on failure (signature mismatch, expired, malformed) — never throws.
 *
 * Reads JWT_ADMIN_SECRET from process.env. Edge runtime supports process.env
 * for non-NEXT_PUBLIC_ vars at request time (Next.js documents this for middleware).
 * Do NOT prefix with NEXT_PUBLIC_ — the secret must never reach the browser.
 */
export async function verifyAdminJwt(token: string | undefined): Promise<AdminJwtClaims | null> {
    if (!token) return null;
    const raw = process.env.JWT_ADMIN_SECRET;
    if (!raw || raw.length < 32) {
        // Fail-closed if env is missing — log via console.error (only signal in Edge runtime).
        // eslint-disable-next-line no-console
        console.error('[middleware] JWT_ADMIN_SECRET missing or shorter than 32 chars');
        return null;
    }
    try {
        const key = new TextEncoder().encode(raw);
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        // Reject tokens that look like refresh tokens (jti present) — middleware authorizes
        // page renders with ACCESS tokens only.
        if ((payload as AdminJwtClaims).jti) return null;
        return payload as AdminJwtClaims;
    } catch {
        return null;
    }
}
