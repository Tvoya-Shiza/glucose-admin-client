import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    subtitle?: string;
    action?: ReactNode;
    className?: string;
}

export function EmptyState({ icon: Icon, title, subtitle, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center',
                className,
            )}
        >
            {Icon && (
                <div className='flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-primary'>
                    <Icon size={22} />
                </div>
            )}
            <div className='space-y-1'>
                <p className='text-sm font-semibold text-foreground'>{title}</p>
                {subtitle && <p className='text-xs text-muted-foreground'>{subtitle}</p>}
            </div>
            {action && <div className='mt-2'>{action}</div>}
        </div>
    );
}
