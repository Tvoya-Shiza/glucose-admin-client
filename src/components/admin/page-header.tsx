import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    actions?: ReactNode;
    badge?: ReactNode;
    className?: string;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions, badge, className }: PageHeaderProps) {
    return (
        <header className={cn('border-b border-border bg-card px-6 py-5', className)}>
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label='breadcrumb' className='mb-2 flex items-center gap-1 text-xs text-muted-foreground'>
                    {breadcrumbs.map((item, idx) => {
                        const last = idx === breadcrumbs.length - 1;
                        return (
                            <span key={`${item.label}-${idx}`} className='flex items-center gap-1'>
                                {item.href && !last ? (
                                    <Link href={item.href} className='transition-colors hover:text-foreground'>
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className={cn(last && 'text-foreground/80')}>{item.label}</span>
                                )}
                                {!last && <ChevronRight size={12} className='shrink-0' />}
                            </span>
                        );
                    })}
                </nav>
            )}
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-3'>
                        <h1 className='truncate text-2xl font-semibold tracking-tight text-foreground'>{title}</h1>
                        {badge}
                    </div>
                    {subtitle && <p className='mt-1 text-sm text-muted-foreground'>{subtitle}</p>}
                </div>
                {actions && <div className='flex shrink-0 items-center gap-2'>{actions}</div>}
            </div>
        </header>
    );
}
