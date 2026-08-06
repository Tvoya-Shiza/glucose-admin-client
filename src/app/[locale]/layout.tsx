import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { routing, type Locale } from '@/i18n/routing';
import { QueryProvider } from '@/lib/query-provider';
import { Toaster } from '@/components/ui/sonner';
import '../globals.css';

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

/**
 * Локаль в адресах у нас `kz`, но это НЕ код языка: по BCP-47 казахский — `kk`.
 * С неизвестным тегом браузер не верит разметке и определяет язык сам по
 * содержимому — а дальше предлагает или сразу включает перевод.
 */
const HTML_LANG: Record<string, string> = { kz: 'kk', ru: 'ru' };

export const metadata = {
    // Дублируем запрет перевода мета-тегом: атрибут translate понимают не все
    // движки перевода, этот тег — понимают.
    other: { google: 'notranslate' },
};

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!routing.locales.includes(locale as Locale)) {
        notFound();
    }
    setRequestLocale(locale);
    const messages = await getMessages();

    return (
        /*
         * translate="no" — не косметика, а защита от падения всей вкладки.
         *
         * Встроенный переводчик Chrome и Edge заменяет каждый текстовый узел на
         * <font>…</font>. React 19 держит ссылки на прежние узлы, и при первой
         * же перерисовке падает с «React.Children.only expected to receive a
         * single React element child», после чего вкладка уходит в цикл и
         * браузер показывает «This page couldn't load».
         *
         * Ловушка срабатывала у методистов с русским интерфейсом браузера:
         * админка на казахском, значит Edge считает её иноязычной и переводит.
         * Режим InPrivate не спасает — перевод это функция браузера, а не
         * расширение. Воспроизведено на проде 06.08.2026.
         */
        <html lang={HTML_LANG[locale] ?? locale} translate="no" className="notranslate">
            {/*
             * suppressHydrationWarning только на body: расширения вроде Grammarly
             * дописывают сюда свои data-атрибуты между рендером сервера и
             * гидрацией — это шум браузера, а не расхождение в нашей разметке.
             */}
            <body suppressHydrationWarning>
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <NuqsAdapter>
                        <QueryProvider>
                            {children}
                            <Toaster />
                        </QueryProvider>
                    </NuqsAdapter>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
