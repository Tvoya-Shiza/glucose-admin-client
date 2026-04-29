interface EmptyStateProps {
    title: string;
    subtitle?: string;
}

/**
 * Generic empty-state for list views (D-06). Plan 02 picks the title/subtitle based
 * on whether filters are active ('No users match these filters' vs 'No users yet').
 */
export function EmptyState({ title, subtitle }: EmptyStateProps) {
    return (
        <div className='flex flex-col items-center justify-center gap-2 py-12 text-center'>
            <p className='text-sm font-medium'>{title}</p>
            {subtitle ? <p className='text-xs text-muted-foreground'>{subtitle}</p> : null}
        </div>
    );
}
