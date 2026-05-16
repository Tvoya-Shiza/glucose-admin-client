'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
    LayoutDashboard,
    Users,
    UsersRound,
    GraduationCap,
    ClipboardList,
    Award,
    FolderOpen,
    Sparkles,
    Image as ImageIcon,
    BookOpen,
    Ticket,
    Bell,
    Mail,
    CreditCard,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
    href: string;
    labelKey: string;
    icon: LucideIcon;
    /**
     * UX-only filter; hard RBAC enforced by middleware + admin-api @Roles.
     * See Phase 7 Plan 01 threat register T-07-01-01.
     */
    adminOnly?: boolean;
}

interface NavSection {
    titleKey: string;
    items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
    {
        titleKey: 'sections.main',
        items: [{ href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard }],
    },
    {
        titleKey: 'sections.content',
        items: [
            { href: '/courses', labelKey: 'courses', icon: GraduationCap },
            { href: '/quizzes', labelKey: 'quizzes', icon: ClipboardList },
            { href: '/quizzes/badges', labelKey: 'badges', icon: Award },
            { href: '/quizzes/results', labelKey: 'results', icon: Award },
            { href: '/files', labelKey: 'files', icon: FolderOpen },
        ],
    },
    {
        titleKey: 'sections.people',
        items: [
            { href: '/users', labelKey: 'users', icon: Users },
            { href: '/groups', labelKey: 'groups', icon: UsersRound },
        ],
    },
    {
        titleKey: 'sections.marketing',
        items: [
            { href: '/stories', labelKey: 'stories', icon: Sparkles, adminOnly: true },
            { href: '/banners', labelKey: 'banners', icon: ImageIcon, adminOnly: true },
            { href: '/blogs', labelKey: 'blogs', icon: BookOpen, adminOnly: true },
            { href: '/promocodes', labelKey: 'promocodes', icon: Ticket, adminOnly: true },
        ],
    },
    {
        titleKey: 'sections.comms',
        items: [
            { href: '/push', labelKey: 'push', icon: Bell, adminOnly: true },
            { href: '/mailings', labelKey: 'mailings', icon: Mail, adminOnly: true },
        ],
    },
    {
        titleKey: 'sections.finance',
        items: [
            { href: '/payments', labelKey: 'payments', icon: CreditCard, adminOnly: true },
            { href: '/sales', labelKey: 'sales', icon: TrendingUp, adminOnly: true },
        ],
    },
];

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

interface AdminNavProps {
    collapsed?: boolean;
    onNavigate?: () => void;
}

export function AdminNav({ collapsed = false, onNavigate }: AdminNavProps) {
    const pathname = usePathname() ?? '';
    const locale = useLocale();
    const t = useTranslations('admin.nav');

    const { data: me } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 60_000,
    });

    const isAdmin = me?.data?.role_name === 'admin';

    return (
        <nav className='flex flex-col gap-5 px-2 py-4'>
            {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
                if (visibleItems.length === 0) return null;

                return (
                    <div key={section.titleKey} className='flex flex-col gap-0.5'>
                        {!collapsed && (
                            <div className='px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70'>
                                {t(section.titleKey)}
                            </div>
                        )}
                        {visibleItems.map((item) => {
                            const fullHref = `/${locale}${item.href}`;
                            const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/');
                            const Icon = item.icon;

                            const link = (
                                <Link
                                    key={item.href}
                                    href={fullHref}
                                    onClick={onNavigate}
                                    className={cn(
                                        'group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
                                        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
                                        isActive
                                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                                    )}
                                >
                                    {isActive && !collapsed && (
                                        <span
                                            aria-hidden
                                            className='absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary'
                                        />
                                    )}
                                    <Icon
                                        size={18}
                                        className={cn(
                                            'shrink-0 transition-colors',
                                            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                                        )}
                                    />
                                    {!collapsed && <span className='truncate'>{t(item.labelKey)}</span>}
                                </Link>
                            );

                            if (collapsed) {
                                return (
                                    <Tooltip key={item.href} delayDuration={200}>
                                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                                        <TooltipContent side='right' className='font-medium'>
                                            {t(item.labelKey)}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }
                            return link;
                        })}
                    </div>
                );
            })}
        </nav>
    );
}
