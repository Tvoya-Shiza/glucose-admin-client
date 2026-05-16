import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BrandLogo } from '@/components/admin/brand-logo';
import { LoginForm } from './login-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('login');

    return (
        <div className='grid min-h-screen lg:grid-cols-2'>
            {/* Brand pane (desktop only) */}
            <aside className='relative hidden overflow-hidden bg-brand-50 lg:flex lg:flex-col lg:justify-between lg:p-12'>
                {/* Radial brand glow */}
                <div
                    aria-hidden
                    className='pointer-events-none absolute inset-0 opacity-60'
                    style={{
                        background:
                            'radial-gradient(900px 600px at 80% 20%, color-mix(in oklch, var(--brand-200) 50%, transparent), transparent), radial-gradient(700px 500px at 20% 90%, color-mix(in oklch, var(--brand-300) 30%, transparent), transparent)',
                    }}
                />
                <div className='relative text-brand-900'>
                    <BrandLogo />
                </div>
                <div className='relative max-w-sm text-brand-900'>
                    <p className='text-3xl font-semibold leading-tight tracking-tight'>{t('hero_title')}</p>
                    <p className='mt-3 text-sm text-brand-900/70'>{t('hero_subtitle')}</p>
                </div>
                <div className='relative text-xs text-brand-900/60'>
                    © {new Date().getFullYear()} Glucose
                </div>
            </aside>

            {/* Form pane */}
            <main className='flex items-center justify-center bg-background px-4 py-10'>
                <div className='w-full max-w-sm space-y-8'>
                    <div className='flex justify-center lg:hidden'>
                        <div className='text-foreground'>
                            <BrandLogo />
                        </div>
                    </div>
                    <div className='space-y-2 text-center lg:text-left'>
                        <h1 className='text-2xl font-semibold tracking-tight'>{t('title')}</h1>
                        <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
                    </div>
                    <Suspense fallback={null}>
                        <LoginForm />
                    </Suspense>
                </div>
            </main>
        </div>
    );
}
