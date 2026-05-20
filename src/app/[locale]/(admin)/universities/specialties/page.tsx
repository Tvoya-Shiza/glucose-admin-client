import { setRequestLocale } from 'next-intl/server';
import { SpecialtiesListClient } from './specialties-list-client';

export const dynamic = 'force-dynamic';

export default async function SpecialtiesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <SpecialtiesListClient />;
}
