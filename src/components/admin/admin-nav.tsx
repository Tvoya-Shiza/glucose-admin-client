'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

interface NavItem {
    href: string; // path under [locale], e.g. '/users'
    labelKey: string; // i18n key under 'admin.nav'
    /**
     * If true, the entry is hidden for any role !== 'admin' on the client side.
     * NOTE: this is UX polish only — the actual gates are (a) edge middleware auth
     * check, (b) @Roles('admin') on every controller method in Plans 02-05. A
     * non-admin who guesses the URL is rejected by admin-api, not by this filter.
     * See Phase 7 Plan 01 threat register T-07-01-01.
     */
    adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', labelKey: 'dashboard' },
    { href: '/users', labelKey: 'users' },
    { href: '/groups', labelKey: 'groups' },
    { href: '/courses', labelKey: 'courses' },
    { href: '/quizzes', labelKey: 'quizzes' },
    { href: '/quizzes/badges', labelKey: 'badges' },
    { href: '/quizzes/results', labelKey: 'results' },
    // File library — every staff role can browse what's been uploaded; admin/teacher
    // can delete. Server enforces role split via @Roles on DELETE /uploads/:id.
    { href: '/files', labelKey: 'files' },
    // Phase 7 — marketing surfaces (admin-only per D-20).
    { href: '/stories', labelKey: 'stories', adminOnly: true },
    { href: '/banners', labelKey: 'banners', adminOnly: true },
    { href: '/blogs', labelKey: 'blogs', adminOnly: true },
    { href: '/promocodes', labelKey: 'promocodes', adminOnly: true },
    // Phase 8 — push + mailings (admin-only per D-19).
    { href: '/push', labelKey: 'push', adminOnly: true },
    { href: '/mailings', labelKey: 'mailings', adminOnly: true },
    // Phase 9 — payments + sales (admin-only per D-18 + D-20). Dashboard entry
    // already exists at the top of NAV_ITEMS (visible to all staff per D-19).
    { href: '/payments', labelKey: 'payments', adminOnly: true },
    { href: '/sales', labelKey: 'sales', adminOnly: true },
    // Phase 10 — audit log surface (visible to all staff; server narrows
    // curator/teacher to own actions per D-02/D-24, see AUDIT_READ_SCOPE_RULES).
    // Page lands in Plan 02; link 404s until then by design (same convention as
    // Phase 5 Plan 01 Courses entry pre-page).
    // { href: '/audit', labelKey: 'audit' },
];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

/**
 * Sidebar navigation for the admin shell. Active link highlighting matches when the
 * current pathname equals or starts with `/[locale]/<href>`.
 *
 * Per-item visibility:
 *   - Items WITHOUT `adminOnly` are visible to every authenticated staff user.
 *   - Items WITH `adminOnly: true` are hidden client-side for non-admin roles
 *     (curator / teacher). This is UX polish — the hard RBAC gates live in
 *     edge middleware + admin-api `@Roles('admin')` (Phase 7 D-20).
 *
 * Phase 7 introduces the four marketing surfaces (stories, banners, blogs,
 * promocodes) under the admin-only flag. Plans 08+ extend NAV_ITEMS as new
 * sections land — keep them ordered top-to-bottom in the same order users
 * encounter the features in the docs.
 */
export function AdminNav() {
    const pathname = usePathname() ?? '';
    const locale = useLocale();
    const t = useTranslations('admin.nav');

    // Reuse the same `auth.me` query key the dashboard already uses so the
    // payload is shared across the shell and we don't double-fetch.
    const { data: me } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 60_000,
    });

    const isAdmin = me?.data?.role_name === 'admin';
    const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

    return (
        <nav className='flex flex-col gap-1 p-3'>
            {visibleItems.map((item) => {
                const fullHref = `/${locale}${item.href}`;
                const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/');
                return (
                    <Link
                        key={item.href}
                        href={fullHref}
                        className={`rounded-md px-3 py-2 text-sm transition-colors ${
                            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        }`}
                    >
                        {t(item.labelKey)}
                    </Link>
                );
            })}
        </nav>
    );
}
