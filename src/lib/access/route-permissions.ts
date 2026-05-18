import type { PermissionCode } from './permission-codes';

/**
 * Route → permission map. Single source of truth used by both:
 *   - <PermissionGate> in the (admin) layout (redirects on missing perm)
 *   - <AdminNav> sidebar (filters hidden items)
 *
 * Adding a new admin route? Register it here. An unmapped route is treated as
 * default-pass (no permission required) — intentional for things like /profile.
 *
 * Keys are locale-stripped paths starting with `/`, no trailing slash.
 * The matcher does longest-prefix matching so nested routes can have stricter
 * requirements than their parents (e.g. /quizzes/badges > /quizzes).
 */
export const ROUTE_PERMISSIONS = {
    '/dashboard': 'dashboard.view',
    '/users': 'users.view',
    '/groups': 'groups.view',
    '/courses': 'courses.view',
    '/quizzes': 'quizzes.view',
    '/quizzes/badges': 'quizzes.badges_manage',
    '/quizzes/results': 'quizzes.results_view',
    '/files': 'files.view',
    '/stories': 'stories.view',
    '/banners': 'banners.view',
    '/blogs': 'blogs.view',
    '/promocodes': 'promocodes.view',
    '/push': 'push.view',
    '/mailings': 'mailings.view',
    '/payments': 'payments.view',
    '/sales': 'sales.view',
    '/access/roles': 'access.manage',
} as const satisfies Record<string, PermissionCode>;

// Matches the configured locales from src/i18n/routing.ts. Keep in sync if
// a new locale is added there.
const LOCALE_RE = /^\/(kz)(?=\/|$)/;

export function stripLocale(pathname: string): string {
    return pathname.replace(LOCALE_RE, '') || '/';
}

/**
 * Longest-prefix match against ROUTE_PERMISSIONS.
 *   '/quizzes/badges/123' → 'quizzes.badges_manage' (not 'quizzes.view')
 *   '/courses/42/edit'    → 'courses.view'
 *   '/profile'            → undefined (unmapped → default-pass)
 */
export function getRequiredPermission(pathname: string): PermissionCode | undefined {
    const path = stripLocale(pathname);
    let best: { key: string; perm: PermissionCode } | undefined;
    for (const [key, perm] of Object.entries(ROUTE_PERMISSIONS) as Array<[string, PermissionCode]>) {
        if (path === key || path.startsWith(key + '/')) {
            if (!best || key.length > best.key.length) {
                best = { key, perm };
            }
        }
    }
    return best?.perm;
}
