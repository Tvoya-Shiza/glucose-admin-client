'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
    LayoutDashboard,
    Users,
    UsersRound,
    GraduationCap,
    ClipboardList,
    ListChecks,
    CalendarDays,
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
    ShieldCheck,
    KanbanSquare,
    Building2,
    Library,
    type LucideIcon,
} from 'lucide-react';
import { useMe } from '@/lib/access/use-me';
import { useIsSuper, usePermissions } from '@/lib/access/use-permission';
import { getRequiredPermission } from '@/lib/access/route-permissions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
    href: string;
    labelKey: string;
    icon: LucideIcon;
}

interface NavSection {
    titleKey: string;
    items: NavItem[];
}

// Required permission per href is resolved via getRequiredPermission() from
// src/lib/access/route-permissions.ts — the single source of truth shared with
// <PermissionGate>. To add a route, register it there.
const NAV_SECTIONS: NavSection[] = [
    {
        titleKey: 'sections.main',
        items: [
            { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
            { href: '/boards', labelKey: 'boards', icon: KanbanSquare },
        ],
    },
    {
        titleKey: 'sections.content',
        items: [
            { href: '/courses', labelKey: 'courses', icon: GraduationCap },
            { href: '/quizzes', labelKey: 'quizzes', icon: ClipboardList },
            { href: '/quizzes/badges', labelKey: 'badges', icon: Award },
            { href: '/quizzes/results', labelKey: 'results', icon: Award },
            { href: '/assignments', labelKey: 'assignments', icon: ListChecks },
            { href: '/schedules', labelKey: 'schedules', icon: CalendarDays },
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
        titleKey: 'sections.education',
        items: [
            { href: '/universities', labelKey: 'universities', icon: Building2 },
            { href: '/universities/specialties', labelKey: 'specialties', icon: Library },
        ],
    },
    {
        titleKey: 'sections.marketing',
        items: [
            { href: '/stories', labelKey: 'stories', icon: Sparkles },
            { href: '/banners', labelKey: 'banners', icon: ImageIcon },
            { href: '/blogs', labelKey: 'blogs', icon: BookOpen },
            { href: '/promocodes', labelKey: 'promocodes', icon: Ticket },
        ],
    },
    {
        titleKey: 'sections.comms',
        items: [
            { href: '/push', labelKey: 'push', icon: Bell },
            { href: '/mailings', labelKey: 'mailings', icon: Mail },
        ],
    },
    {
        titleKey: 'sections.finance',
        items: [
            { href: '/payments', labelKey: 'payments', icon: CreditCard },
            { href: '/sales', labelKey: 'sales', icon: TrendingUp },
        ],
    },
    {
        titleKey: 'sections.admin',
        items: [{ href: '/access/roles', labelKey: 'access', icon: ShieldCheck }],
    },
];

interface AdminNavProps {
    collapsed?: boolean;
    onNavigate?: () => void;
}

export function AdminNav({ collapsed = false, onNavigate }: AdminNavProps) {
    const pathname = usePathname() ?? '';
    const locale = useLocale();
    const t = useTranslations('admin.nav');

    const { data: me, isPending } = useMe();
    const isSuper = useIsSuper();
    const perms = usePermissions();

    // Skeleton while /auth/me is loading OR before the first fetch has settled
    // (useQuery's default state is { data: undefined, isLoading: false } so we
    // also need to treat undefined data as a loading sentinel — otherwise the
    // filter below collapses every item and the sidebar renders empty).
    if (isPending || !me) {
        return (
            <nav className='flex flex-col gap-5 px-2 py-4'>
                {Array.from({ length: 6 }).map((_, sectionIdx) => (
                    <div key={sectionIdx} className='flex flex-col gap-0.5'>
                        {!collapsed && <div className='mx-3 mb-1.5 h-3 w-20 animate-pulse rounded bg-muted/60' />}
                        {Array.from({ length: sectionIdx === 0 ? 1 : 2 }).map((__, itemIdx) => (
                            <div
                                key={itemIdx}
                                className={cn(
                                    'flex items-center gap-3 rounded-md',
                                    collapsed ? 'mx-auto h-10 w-10' : 'mx-2 h-9 px-3',
                                )}
                            >
                                <div className='h-4 w-4 shrink-0 animate-pulse rounded bg-muted/60' />
                                {!collapsed && <div className='h-3 flex-1 animate-pulse rounded bg-muted/40' />}
                            </div>
                        ))}
                    </div>
                ))}
            </nav>
        );
    }

    return (
        <nav className='flex flex-col gap-5 px-2 py-4'>
            {NAV_SECTIONS.map((section) => {
                const visibleItems = section.items.filter((item) => {
                    const required = getRequiredPermission(item.href);
                    return !required || isSuper || perms.has(required);
                });
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
