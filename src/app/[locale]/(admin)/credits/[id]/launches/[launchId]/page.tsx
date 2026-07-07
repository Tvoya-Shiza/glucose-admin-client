import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LaunchConsoleClient } from './launch-console-client';

/**
 * Phase 34 — thin server shell for the conduct console. Credit + launch ids
 * are BigInt-as-STRING — validated as digit strings, never Number()-coerced.
 */
export const dynamic = 'force-dynamic';

export default async function LaunchConsolePage({ params }: { params: Promise<{ locale: string; id: string; launchId: string }> }) {
    const { locale, id, launchId } = await params;
    setRequestLocale(locale);
    if (!/^\d+$/.test(id) || !/^\d+$/.test(launchId)) notFound();
    return <LaunchConsoleClient creditId={id} launchId={launchId} />;
}
