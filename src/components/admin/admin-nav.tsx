'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

interface NavItem {
    href: string; // path under [locale], e.g. '/users'
    labelKey: string; // i18n key under 'admin.nav'
}

const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', labelKey: 'dashboard' },
    { href: '/users', labelKey: 'users' },
    // Phase 4+: groups, courses, quizzes, stories, banners, blogs, push, payments, audit
];

/**
 * Sidebar navigation for the admin shell. Active link highlighting matches when the
 * current pathname equals or starts with `/[locale]/<href>`. Phase 7+ extends NAV_ITEMS
 * as new admin sections land — keep it ordered top-to-bottom in the same order users
 * encounter the features in the docs.
 */
export function AdminNav() {
    const pathname = usePathname() ?? '';
    const locale = useLocale();
    const t = useTranslations('admin.nav');

    return (
        <nav className='flex flex-col gap-1 p-3'>
            {NAV_ITEMS.map((item) => {
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
