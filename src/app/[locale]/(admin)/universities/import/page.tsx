import { setRequestLocale } from 'next-intl/server';
import { ImportClient } from './import-client';

export const dynamic = 'force-dynamic';

export default async function UniversitiesImportPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ImportClient />;
}
