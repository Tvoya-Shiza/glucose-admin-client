import { getTranslations } from 'next-intl/server';
import { DashboardRouter } from './dashboard-router';

/**
 * Phase 9 ANL-01..04 (D-11, D-19) — dashboard server-component shell.
 *
 * Replaces the Phase 2 placeholder. Picks up the role from the BFF auth.me
 * endpoint (cached client-side via TanStack Query) and delegates rendering to
 * `<DashboardRouter />`, which selects the matching view (admin / curator /
 * teacher) and exposes the admin-only `?as_role=` pivot.
 *
 * Title still uses the existing `dashboard.title` namespace (untouched from
 * Phase 2). View-specific copy lives under `admin.dashboard.*` (seeded in
 * Plan 01).
 */
export default async function DashboardPage() {
    const t = await getTranslations('dashboard');
    return (
        <div className='mx-auto w-full max-w-7xl space-y-6 px-4 py-8'>
            <header>
                <h1 className='text-2xl font-semibold'>{t('title')}</h1>
            </header>
            <DashboardRouter />
        </div>
    );
}
