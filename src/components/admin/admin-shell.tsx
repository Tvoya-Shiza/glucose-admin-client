import type { ReactNode } from 'react';
import { AdminNav } from './admin-nav';

/**
 * Authed admin shell — sidebar + main content area. Used by every route under
 * `app/[locale]/(admin)/*` via the (admin) route-group layout.
 *
 * Phase 3 keeps this thin (header just shows the brand). Future phases may add a
 * top bar with user menu / locale toggle here.
 */
export function AdminShell({ children }: { children: ReactNode }) {
    return (
        <div className='flex min-h-screen'>
            <aside className='w-64 border-r bg-card'>
                <div className='border-b p-4 text-sm font-semibold'>Glucose Admin</div>
                <AdminNav />
            </aside>
            <main className='flex-1 overflow-auto'>{children}</main>
        </div>
    );
}
