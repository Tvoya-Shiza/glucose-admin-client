import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from './login-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('login');

    return (
        <div className='flex min-h-screen items-center justify-center px-4'>
            <div className='w-full max-w-sm space-y-6'>
                <div className='space-y-1 text-center'>
                    <h1 className='text-2xl font-semibold'>{t('title')}</h1>
                    <p className='text-muted-foreground text-sm'>{t('subtitle')}</p>
                </div>
                {/*
                 * LoginForm reads useSearchParams() to honor ?next= for post-login redirect.
                 * Next 16 statically renders /[locale]/login at build, so the client hook must
                 * sit inside a Suspense boundary or the prerender bails out.
                 */}
                <Suspense fallback={null}>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    );
}
