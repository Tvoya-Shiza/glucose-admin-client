'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Phase 8 Plan 03 — push surface tabs (Compose / Schedule / History).
 *
 * Schedule tab is rendered but its destination route lands in Plan 04. The
 * stub stays here so curators/teachers see consistent navigation while
 * Plan 04 is in flight.
 */
export function PushTabs() {
    const t = useTranslations('admin.push');
    const locale = useLocale();
    const pathname = usePathname() ?? '';

    const tabs = [
        { key: 'compose_tab', href: `/${locale}/push/compose` },
        { key: 'schedule_tab', href: `/${locale}/push/schedule` },
        { key: 'history_tab', href: `/${locale}/push/history` },
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
