import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next App Router loading boundary for `/[locale]/payments`. Renders 10 skeleton
 * rows while Plan 02's payments-list page resolves. Doubles as the Suspense boundary
 * required by nuqs `useQueryStates` -> `useSearchParams()` at static-export time
 * (mirrors users/loading.tsx).
 */
export default function PaymentsLoading() {
    return (
        <div className='space-y-3 p-6'>
            {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
            ))}
        </div>
    );
}
