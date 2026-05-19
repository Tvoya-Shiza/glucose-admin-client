'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AdminNav } from './admin-nav';
import { BrandLogo } from './brand-logo';
import { SidebarFooter } from './sidebar-footer';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'glc_admin_sidebar_collapsed';

export function AdminShell({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(COLLAPSED_KEY);
            if (stored === '1') setCollapsed(true);
        } catch {
            /* ignore */
        }
        setHydrated(true);
    }, []);

    function toggleCollapsed() {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    }

    return (
        <TooltipProvider>
            <div className='flex h-screen overflow-hidden bg-background'>
                {/* Desktop sidebar */}
                <aside
                    className={cn(
                        'hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
                        collapsed ? 'w-[68px]' : 'w-64',
                    )}
                >
                    <div
                        className={cn(
                            'flex h-14 shrink-0 items-center border-b border-sidebar-border',
                            collapsed ? 'justify-center px-2' : 'justify-between px-4',
                        )}
                    >
                        <div className='text-foreground'>
                            <BrandLogo compact={collapsed} />
                        </div>
                        {!collapsed && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={toggleCollapsed}
                                className='h-8 w-8 text-muted-foreground hover:text-foreground'
                                aria-label='Collapse sidebar'
                            >
                                <PanelLeftClose size={16} />
                            </Button>
                        )}
                    </div>

                    <div className='flex-1 overflow-y-auto'>{hydrated && <AdminNav collapsed={collapsed} />}</div>

                    {collapsed && (
                        <div className='flex justify-center p-2'>
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={toggleCollapsed}
                                className='h-8 w-8 text-muted-foreground hover:text-foreground'
                                aria-label='Expand sidebar'
                            >
                                <PanelLeftOpen size={16} />
                            </Button>
                        </div>
                    )}

                    <SidebarFooter collapsed={collapsed} />
                </aside>

                {/* Main column */}
                <div className='flex min-w-0 flex-1 flex-col'>
                    {/* Mobile topbar */}
                    <header className='flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 md:hidden'>
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant='ghost' size='icon' aria-label='Open navigation'>
                                    <Menu size={20} />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side='left' className='flex w-72 flex-col gap-0 bg-sidebar p-0'>
                                <SheetTitle className='sr-only'>Navigation</SheetTitle>
                                <div className='flex h-14 shrink-0 items-center border-b border-sidebar-border px-4 text-foreground'>
                                    <BrandLogo />
                                </div>
                                <div className='flex-1 overflow-y-auto'>
                                    <AdminNav onNavigate={() => setMobileOpen(false)} />
                                </div>
                                <SidebarFooter />
                            </SheetContent>
                        </Sheet>
                        <div className='text-foreground'>
                            <BrandLogo />
                        </div>
                        <div className='w-9' />
                    </header>

                    <main className='flex-1 overflow-auto'>{children}</main>
                </div>

                {/* Floating notification bell — fixed bottom-right; lives outside
                    the per-page layout so every admin page gets it for free. */}
                <NotificationBell />
            </div>
        </TooltipProvider>
    );
}
