'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, LogOut, User as UserIcon } from 'lucide-react';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

interface SidebarFooterProps {
    collapsed?: boolean;
}

export function SidebarFooter({ collapsed = false }: SidebarFooterProps) {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('admin.footer');

    const { data: me } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
        staleTime: 60_000,
    });

    const email = me?.data?.email ?? '';
    const role = me?.data?.role_name ?? '';
    const initial = (email || role || '?').slice(0, 1).toUpperCase();

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            /* even if it fails, cookies clear server-side */
        }
        router.push(`/${locale}/login`);
        router.refresh();
    }

    return (
        <div className='border-t border-sidebar-border p-2'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type='button'
                        className={cn(
                            'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent/60',
                            collapsed && 'justify-center',
                        )}
                    >
                        <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground'>
                            {initial}
                        </span>
                        {!collapsed && (
                            <>
                                <div className='min-w-0 flex-1'>
                                    <div className='truncate text-sm font-medium text-sidebar-foreground'>{email || '—'}</div>
                                    <div className='truncate text-xs capitalize text-muted-foreground'>{role}</div>
                                </div>
                                <ChevronsUpDown size={14} className='shrink-0 text-muted-foreground' />
                            </>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side='top' align='start' className='w-56'>
                    <DropdownMenuLabel className='font-normal'>
                        <div className='truncate text-sm font-medium'>{email || '—'}</div>
                        <div className='truncate text-xs capitalize text-muted-foreground'>{role}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <UserIcon size={14} className='mr-2' />
                        {t('profile')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className='text-destructive focus:text-destructive'>
                        <LogOut size={14} className='mr-2' />
                        {t('logout')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
