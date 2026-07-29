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
        <html lang={locale}>
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
