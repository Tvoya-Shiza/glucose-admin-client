import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

type Props = {
    params: Promise<{ locale: string }>;
};

/**
 * Корень локали — не страница, а перенаправление на дашборд.
 *
 * Раньше здесь висела заглушка Phase 0 (карточка с кнопкой «OK»), и вход
 * упирался в неё: middleware отправляет неавторизованного с «/» на
 * `/login?next=/`, после успешного входа форма честно возвращает на «/» —
 * и пользователь попадал в тупик вместо панели.
 */
export default async function Home({ params }: Props) {
    const { locale } = await params;
    const safeLocale = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
    redirect({ href: '/dashboard', locale: safeLocale as (typeof routing.locales)[number] });
}
