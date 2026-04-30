import { setRequestLocale } from 'next-intl/server';
import { ImportClient } from './import-client';

/**
 * USR-06 — /[locale]/users/import.
 *
 * Server component shell. The CSV parser + papaparse + dry-run/commit flow lives in
 * the client component (papaparse is a browser-side library; parsing on the server
 * would defeat the 5MB / 10k-row DoS protection at the trust boundary).
 */
export default async function UsersImportPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ImportClient />;
}
