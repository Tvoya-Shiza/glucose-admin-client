import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AssignmentDetailClient } from './assignment-detail-client';

export const dynamic = 'force-dynamic';

export default async function AssignmentDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    const assignmentId = Number(id);
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
        // Returning null here breaks the root layout chain — use notFound() so
        // Next.js renders the 404 boundary with the proper <html>/<body>.
        notFound();
    }
    return <AssignmentDetailClient assignmentId={assignmentId} />;
}
