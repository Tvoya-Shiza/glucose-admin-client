import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { MailingsTabs } from './mailings-tabs';

/**
 * Phase 8 Plan 05 — Mailings section layout: header + tabs + child page.
 */
export default async function MailingsLayout({ children }: { children: ReactNode }) {
    const t = await getTranslations('admin.mailings');

    return (
        <div className='flex flex-col gap-4 p-6'>
            <div>
                <h1 className='text-2xl font-semibold'>{t('title')}</h1>
            </div>
            <MailingsTabs />
            <div>{children}</div>
        </div>
    );
}
