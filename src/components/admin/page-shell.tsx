import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
    header?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    contentClassName?: string;
}

export function PageShell({ header, children, footer, contentClassName }: PageShellProps) {
    return (
        <div className='flex h-full flex-col bg-background'>
            {header}
            <div className={cn('flex-1 overflow-auto px-6 py-5', contentClassName)}>{children}</div>
            {footer}
        </div>
    );
}
