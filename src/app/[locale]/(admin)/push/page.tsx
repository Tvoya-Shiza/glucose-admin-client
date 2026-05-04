import { redirect } from 'next/navigation';

/**
 * Phase 8 Plan 03 — /[locale]/push redirects to /compose so the section
 * has a deterministic landing tab.
 */
export default async function PushIndex({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    redirect(`/${locale}/push/compose`);
}
