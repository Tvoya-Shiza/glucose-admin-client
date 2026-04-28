import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['ru', 'kz'],
    defaultLocale: 'ru',
    // Cookie-aware negotiation; falls back to Accept-Language; last fallback to defaultLocale.
    localeDetection: true,
    // 'as-needed' so /ru/* is the canonical URL set; /'' redirects to /ru/.
    localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
