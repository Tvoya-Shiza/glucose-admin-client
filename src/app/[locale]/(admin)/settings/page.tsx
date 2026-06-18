import { setRequestLocale } from 'next-intl/server';
import { SettingsPageClient } from './settings-page-client';

/**
 * Global settings page — server shell that mounts SettingsPageClient.
 *
 * `force-dynamic`: the client uses TanStack Query (`/api/proxy/*`, `/api/auth/me`).
 * Same posture as the schedules / courses pages.
 */
export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <SettingsPageClient />;
}
