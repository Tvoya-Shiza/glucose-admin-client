'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export interface BulkActionToolbarProps {
    selectedCount: number;
    onClear: () => void;
    /** Action buttons (e.g. "Grant access", "Change status") rendered inline. */
    children?: ReactNode;
}

/**
 * Sticky toolbar shown above a data table when at least one row is selected.
 * Rendered as a no-op when `selectedCount === 0` so call sites can mount it
 * unconditionally.
 *
 * Reused by Phase 3 Plans 05/06 + Phase 7 bulk-status flows.
 */
export function BulkActionToolbar({ selectedCount, onClear, children }: BulkActionToolbarProps) {
    const t = useTranslations('admin.users');
    if (selectedCount === 0) return null;
    return (
        <div className='sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/90 p-3 backdrop-blur'>
            <div className='text-sm font-medium'>{t('bulk_selected', { count: selectedCount })}</div>
            <div className='flex items-center gap-2'>
                {children}
                <Button variant='ghost' size='sm' onClick={onClear}>
                    {t('bulk_clear')}
                </Button>
            </div>
        </div>
    );
}
