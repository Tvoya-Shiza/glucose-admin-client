import { setRequestLocale } from 'next-intl/server';
import { UniversitiesListClient } from './universities-list-client';

export const dynamic = 'force-dynamic';

export default async function UniversitiesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <UniversitiesListClient />;
}
