'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMe } from './use-me';
import { getRequiredPermission } from './route-permissions';

/**
 * Route-level permission gate. Mounted once in (admin)/layout.tsx — wraps every
 * admin page.
 *
 * Behavior:
 *   - While /api/auth/me is pending → render nothing (deny-during-load, mirrors
 *     usePermission). Pages have their own skeletons; one blank frame is fine
 *     and prevents flash-redirect.
 *   - On /me error → render children (let the page's own error branch show);
 *     do NOT redirect — would mask auth failure and middleware will handle 401.
 *   - Allowed (no route mapping, is_super, or permission present) → render children.
 *   - Denied → render null and trigger redirect to /:locale/dashboard with a toast.
 *
 * Adding a new admin route? Register it in route-permissions.ts.
 */
export function PermissionGate({ children }: { children: ReactNode }) {
    const pathname = usePathname() ?? '/';
    const locale = useLocale();
    const router = useRouter();
    const t = useTranslations('admin.access');
    const { data: me, isPending, error } = useMe();
    const toastedFor = useRef<string | null>(null);

    const required = getRequiredPermission(pathname);
    const isSuper = !!me && (me.is_super || me.role_name === 'admin');
    const allowed = !required || isSuper || (me?.permissions ?? []).includes(required);

    // Effect runs every render (rules of hooks); body short-circuits unless
    // /me is loaded and the user is denied.
    useEffect(() => {
        if (isPending || error || !me || allowed) return;
        if (toastedFor.current === pathname) return;
        toastedFor.current = pathname;
        toast.error(t('no_access'));
        router.replace(`/${locale}/dashboard`);
    }, [isPending, error, me, allowed, pathname, locale, router, t]);

    if (isPending) return null;
    if (error || !me) return <>{children}</>;
    if (!allowed) return null;
    return <>{children}</>;
}
