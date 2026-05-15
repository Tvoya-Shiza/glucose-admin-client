import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['kz'],
    defaultLocale: 'kz',
    // Cookie-aware negotiation; falls back to Accept-Language; last fallback to defaultLocale.
    localeDetection: true,
    // 'as-needed' so /kz/* is the canonical URL set; /'' redirects to /kz/.
    localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
