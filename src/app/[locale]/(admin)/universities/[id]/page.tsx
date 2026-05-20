import { setRequestLocale } from 'next-intl/server';
import { UniversityDetailClient } from './university-detail-client';

export const dynamic = 'force-dynamic';

export default async function UniversityDetailPage({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}) {
    const { locale, id } = await params;
    setRequestLocale(locale);
    return <UniversityDetailClient id={Number(id)} />;
}
