import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next App Router loading boundary for `/[locale]/users`. Renders 10 skeleton rows
 * while Plan 02's users-list page resolves. Skipped after first paint per D-05
 * (filter changes re-render TableBody silently, not the whole skeleton).
 */
export default function UsersLoading() {
    return (
        <div className='space-y-3 p-6'>
            {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
            ))}
        </div>
    );
}
