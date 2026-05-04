import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { PushTabs } from './push-tabs';

/**
 * Phase 8 Plan 03 — Push section layout: header + tabs + child page.
 */
export default async function PushLayout({ children }: { children: ReactNode }) {
    const t = await getTranslations('admin.push');

    return (
        <div className='flex flex-col gap-4 p-6'>
            <div>
                <h1 className='text-2xl font-semibold'>{t('title')}</h1>
            </div>
            <PushTabs />
            <div>{children}</div>
        </div>
    );
}
