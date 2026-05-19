import { setRequestLocale } from 'next-intl/server';
import { BoardsListClient } from './boards-list-client';

/**
 * Phase 12 — server shell for /boards. The (admin) route-group layout already
 * wraps every authed route in <AdminShell>; this page just hands over to the
 * client component (TanStack Query + nuqs state live there).
 */
export default async function BoardsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <BoardsListClient />;
}
