import { redirect } from 'next/navigation';

/**
 * Phase 8 Plan 05 — /[locale]/mailings redirects to /compose so the section
 * has a deterministic landing tab.
 */
export default async function MailingsIndex({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    redirect(`/${locale}/mailings/compose`);
}
