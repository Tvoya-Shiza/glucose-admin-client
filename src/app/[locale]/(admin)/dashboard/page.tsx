import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/admin/page-header';
import { PageShell } from '@/components/admin/page-shell';
import { DashboardRouter } from './dashboard-router';

/**
 * Phase 9 ANL-01..04 (D-11, D-19) — dashboard server-component shell.
 *
 * Replaces the Phase 2 placeholder. Picks up the role from the BFF auth.me
 * endpoint (cached client-side via TanStack Query) and delegates rendering to
 * `<DashboardRouter />`, which selects the matching view (admin / curator /
 * teacher) and exposes the admin-only `?as_role=` pivot.
 */
export default async function DashboardPage() {
    const t = await getTranslations('dashboard');
    return (
        <PageShell header={<PageHeader title={t('title')} subtitle={t('welcome')} />}>
            <DashboardRouter />
        </PageShell>
    );
}
