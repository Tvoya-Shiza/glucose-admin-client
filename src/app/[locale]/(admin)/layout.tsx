import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';

/**
 * Wraps every route under `app/[locale]/(admin)/*` (e.g. /dashboard, /users) in the
 * authed admin shell. The auth gate itself is enforced by `middleware.ts` — this
 * layout assumes the request has already been authenticated.
 */
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
    return <AdminShell>{children}</AdminShell>;
}
