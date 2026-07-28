import { setRequestLocale } from 'next-intl/server';
import { ThemesListClient } from './themes-list-client';

/**
 * Phase 43 — оболочка справочника тем оформления тренажёра.
 *
 * Статический сегмент, поэтому выигрывает у соседнего динамического
 * `/trainers/[id]`. Тема прав своих не имеет: чтение — `trainers.view`,
 * который уже покрыт сопоставлением маршрута `/trainers` по префиксу,
 * мутации — `trainers.edit`.
 */
export const dynamic = 'force-dynamic';

export default async function TrainerThemesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <ThemesListClient />;
}
