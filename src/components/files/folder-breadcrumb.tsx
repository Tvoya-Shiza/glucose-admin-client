'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';
import type { FileFolder } from '@shared/folders';
import { cn } from '@/lib/utils';

export interface FolderBreadcrumbProps {
    /** Ancestor chain from root → current folder (current folder last). */
    crumbs: FileFolder[];
    onNavigate: (id: number | null) => void;
    className?: string;
}

export function FolderBreadcrumb({ crumbs, onNavigate, className }: FolderBreadcrumbProps) {
    const t = useTranslations('files.folders');
    return (
        <nav
            aria-label='folder breadcrumb'
            className={cn('text-muted-foreground flex flex-wrap items-center gap-1 text-sm', className)}
        >
            <button
                type='button'
                onClick={() => onNavigate(null)}
                className='hover:text-foreground inline-flex items-center gap-1'
            >
                <Home className='h-3.5 w-3.5' />
                <span>{t('root')}</span>
            </button>
            {crumbs.map((c, idx) => (
                <Fragment key={c.id}>
                    <ChevronRight className='h-3.5 w-3.5' />
                    <button
                        type='button'
                        onClick={() => onNavigate(c.id)}
                        className={cn(
                            'hover:text-foreground',
                            idx === crumbs.length - 1 ? 'text-foreground font-medium' : '',
                        )}
                    >
                        {c.name}
                    </button>
                </Fragment>
            ))}
        </nav>
    );
}
