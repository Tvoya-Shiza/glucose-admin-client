import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next App Router loading boundary for `/[locale]/sales`. Renders 10 skeleton
 * rows while the sales-list page resolves. Doubles as the Suspense boundary
 * required by nuqs `useQueryStates` -> `useSearchParams()` at static-export time
 * (mirrors users/loading.tsx + payments/loading.tsx).
 */
export default function SalesLoading() {
    return (
        <div className='space-y-3 p-6'>
            {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
            ))}
        </div>
    );
}
