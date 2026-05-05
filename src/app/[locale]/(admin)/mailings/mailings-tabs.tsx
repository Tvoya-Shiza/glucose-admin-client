'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Phase 8 Plan 05 — mailings surface tabs (Compose / History).
 *
 * Mirrors PushTabs structure with two tabs (mailings has no schedule surface
 * in v1 — Phase 9+ may add scheduled mailings).
 */
export function MailingsTabs() {
    const t = useTranslations('admin.mailings');
    const locale = useLocale();
    const pathname = usePathname() ?? '';

    const tabs = [
        { key: 'compose_tab' as const, href: `/${locale}/mailings/compose` },
        { key: 'history_tab' as const, href: `/${locale}/mailings/history` },
    ];

    return (
        <div className='flex gap-2 border-b'>
            {tabs.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
                return (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        className={cn(
                            '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
                            active
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {t(tab.key)}
                    </Link>
                );
            })}
        </div>
    );
}
